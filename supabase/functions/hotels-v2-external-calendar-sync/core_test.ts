import {
  assertSafeHttpsUrl,
  CONTRACTS,
  fetchCalendar,
  LIMITS,
  parseBeginResult,
  parseICalendar,
  parseSchedulerLeaseResult,
  parseSourceContract,
  parseWorkerRequest,
  type PinnedConnection,
  type PinnedConnector,
  type PinnedHttpsTarget,
  sanitizeFailure,
  WorkerError,
} from "./core.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

async function rejectsCode(action: () => unknown | Promise<unknown>, code: string): Promise<void> {
  try { await action(); } catch (error) {
    assert(error instanceof WorkerError, "Expected WorkerError");
    assert(error.code === code, `Expected ${code}, received ${error.code}`);
    return;
  }
  throw new Error(`Expected ${code}`);
}

const resolvePublic = async (_hostname: string, type: "A" | "AAAA") => type === "A" ? ["93.184.216.34"] : [];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function rawResponse(
  body: string,
  options: { status?: number; headers?: Record<string, string>; framing?: "length" | "chunked" | "close" } = {},
): Uint8Array {
  const status = options.status ?? 200;
  const framing = options.framing ?? "length";
  const bodyBytes = encoder.encode(body);
  const headers: Record<string, string> = { "content-type": "text/calendar", ...(options.headers || {}) };
  let wireBody = bodyBytes;
  if (framing === "length" && !Object.keys(headers).some((name) => name.toLowerCase() === "content-length")) {
    headers["content-length"] = String(bodyBytes.length);
  }
  if (framing === "chunked") {
    headers["transfer-encoding"] = "chunked";
    const midpoint = Math.max(1, Math.floor(bodyBytes.length / 2));
    wireBody = encoder.encode([
      body.slice(0, midpoint).length.toString(16), body.slice(0, midpoint),
      body.slice(midpoint).length.toString(16), body.slice(midpoint),
      "0", "", "",
    ].join("\r\n"));
  }
  const head = encoder.encode([
    `HTTP/1.1 ${status} ${status === 200 ? "OK" : "Status"}`,
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    "", "",
  ].join("\r\n"));
  const result = new Uint8Array(head.length + wireBody.length);
  result.set(head); result.set(wireBody, head.length);
  return result;
}

function fakeConnector(
  responseFor: (target: PinnedHttpsTarget) => Uint8Array,
  observations: { targets: PinnedHttpsTarget[]; requests: string[]; closes: number },
  fragmentBytes = 7,
): PinnedConnector {
  return async (target) => {
    observations.targets.push(target);
    const response = responseFor(target);
    const written: Uint8Array[] = [];
    let position = 0;
    let closed = false;
    const connection: PinnedConnection = {
      async read(buffer) {
        if (closed || position >= response.length) return null;
        const length = Math.min(buffer.length, fragmentBytes, response.length - position);
        buffer.set(response.subarray(position, position + length));
        position += length;
        return length;
      },
      async write(buffer) {
        const length = Math.max(1, Math.min(5, buffer.length));
        written.push(buffer.slice(0, length));
        return length;
      },
      close() {
        if (closed) return;
        closed = true;
        observations.closes += 1;
        const length = written.reduce((total, chunk) => total + chunk.length, 0);
        const value = new Uint8Array(length); let offset = 0;
        for (const chunk of written) { value.set(chunk, offset); offset += chunk.length; }
        observations.requests.push(decoder.decode(value));
      },
    };
    return connection;
  };
}

Deno.test("accepts only the exact bounded internal request envelope", () => {
  const request = parseWorkerRequest({
    contract_version: CONTRACTS.request,
    enqueue_scheduled: true,
    limit: 1,
  });
  assert(request.limit === 1);
  for (const invalid of [
    { ...request, limit: LIMITS.sources + 1 },
    { ...request, enqueue_scheduled: "true" },
    { ...request, unexpected: true },
    { ...request, limit: 0 },
  ]) {
    let failed = false;
    try { parseWorkerRequest(invalid); } catch { failed = true; }
    assert(failed, "Invalid request must fail closed");
  }
});

Deno.test("accepts the exact 4096-character Stage 2A URL and strict Hotel timezone source DTO", () => {
  const prefix = "https://calendar.example/";
  const source = parseSourceContract({
    contract_version: CONTRACTS.source,
    source_id: "11111111-1111-4111-8111-111111111111",
    hotel_id: "22222222-2222-4222-8222-222222222222",
    room_type_id: "33333333-3333-4333-8333-333333333333",
    source_type: "ical",
    source_version: 1,
    binding_version: 2,
    is_enabled: true,
    review_status: "reviewed",
    hotel_external_sync_enabled: true,
    hotel_timezone: "Europe/Nicosia",
    ical_url: prefix + "a".repeat(LIMITS.urlCharacters - prefix.length),
  });
  assert(source.ical_url.length === LIMITS.urlCharacters);
  let failed = false;
  try { parseSourceContract({ ...source, hotel_timezone: "Invalid/Timezone" }); } catch { failed = true; }
  assert(failed, "An invalid Hotel timezone must fail closed");
});

Deno.test("normalizes all-day, UTC, offset and cancelled VEVENT data without retaining UID", async () => {
  const calendar = await parseICalendar([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:all-day-provider-identity",
    "DTSTART;VALUE=DATE:20260901",
    "DTEND;VALUE=DATE:20260904",
    "SEQUENCE:3",
    "LAST-MODIFIED:20260825T100000Z",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:cancelled-provider-identity",
    "DTSTART:20260905T210000+0200",
    "DTEND:20260906T090000+0200",
    "STATUS:CANCELLED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n"));
  assert(calendar.event_count === 2);
  assert(calendar.active_event_count === 1);
  assert(calendar.total_active_days === 3);
  assert(calendar.events[0].external_uid_hash.length === 64);
  assert(JSON.stringify(calendar).includes("provider-identity") === false, "Raw UID must not survive normalization");
  const active = calendar.events.find((event) => event.event_status === "active")!;
  assert(active.starts_on === "2026-09-01" && active.ends_on === "2026-09-04");
  assert(active.source_sequence === 3 && active.source_last_modified_at === "2026-08-25T10:00:00.000Z");
});

Deno.test("normalizes UTC instants to Hotel-local stay dates", async () => {
  const calendar = await parseICalendar([
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:hotel-local-date",
    "DTSTART:20260901T220000Z",
    "DTEND:20260902T210000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n"), "Europe/Nicosia");
  assert(calendar.events[0].starts_on === "2026-09-02");
  assert(calendar.events[0].ends_on === "2026-09-03");
  assert(calendar.total_active_days === 1);
});

Deno.test("treats a later local departure date as exclusive and gives a same-day timed event one night", async () => {
  const calendar = await parseICalendar([
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT", "UID:rental-night", "DTSTART:20260901T120000Z", "DTEND:20260902T080000Z", "END:VEVENT",
    "BEGIN:VEVENT", "UID:same-day", "DTSTART:20260904T070000Z", "DTEND:20260904T090000Z", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n"), "Europe/Nicosia");
  const rental = calendar.events.find((event) => event.starts_on === "2026-09-01")!;
  const sameDay = calendar.events.find((event) => event.starts_on === "2026-09-04")!;
  assert(rental.ends_on === "2026-09-02", "Departure date must remain the exclusive Hotel-local bound");
  assert(sameDay.ends_on === "2026-09-05", "A same-local-day timed event must still block one day");
  assert(calendar.total_active_days === 2);
});

Deno.test("strictly validates scheduler jobs and attempt receipts", () => {
  const job = {
    job_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    source_id: "22222222-2222-4222-8222-222222222222",
    hotel_id: "33333333-3333-4333-8333-333333333333",
    room_type_id: "44444444-4444-4444-8444-444444444444",
    source_version: 1,
    binding_version: 1,
    trigger_type: "scheduled",
    lease_token: "55555555-5555-4555-8555-555555555555",
    leased_until: "2026-08-25T12:00:00+00:00",
  };
  const lease = parseSchedulerLeaseResult({
    contract_version: CONTRACTS.schedulerLease,
    global_enabled: true,
    jobs: [job],
  });
  assert(lease.jobs.length === 1);
  const attempt = "66666666-6666-4666-8666-666666666666";
  parseBeginResult({
    contract_version: CONTRACTS.beginResult,
    attempt_id: attempt,
    job_id: job.job_id,
    source_id: job.source_id,
    status: "running",
    replayed: false,
  }, { attempt_id: attempt, job_id: job.job_id, source_id: job.source_id });
  for (const invalid of [
    { ...job, job_id: job.job_id.toUpperCase() },
    { ...job, leased_until: "2026-02-30T12:00:00Z" },
    { ...job, unexpected: true },
  ]) {
    let failed = false;
    try { parseSchedulerLeaseResult({ contract_version: CONTRACTS.schedulerLease, global_enabled: true, jobs: [invalid] }); } catch { failed = true; }
    assert(failed, "An invalid lease DTO must fail closed");
  }
});

Deno.test("selects the highest sequence/last-modified duplicate deterministically", async () => {
  const calendar = await parseICalendar([
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT", "UID:same", "DTSTART;VALUE=DATE:20260901", "DTEND;VALUE=DATE:20260902", "SEQUENCE:1", "END:VEVENT",
    "BEGIN:VEVENT", "UID:same", "DTSTART;VALUE=DATE:20260903", "DTEND;VALUE=DATE:20260904", "SEQUENCE:2", "STATUS:CANCELLED", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n"));
  assert(calendar.event_count === 1);
  assert(calendar.events[0].source_sequence === 2);
  assert(calendar.events[0].event_status === "cancelled");
  assert(calendar.active_event_count === 0);
});

Deno.test("fails closed on floating time, reversed range, missing DTEND and day caps", async () => {
  await rejectsCode(() => parseICalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART:20260901T100000\nDTEND:20260901T110000\nEND:VEVENT\nEND:VCALENDAR"), "invalid_event_datetime");
  await rejectsCode(() => parseICalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART:20260901T120000Z\nDTEND:20260901T110000Z\nEND:VEVENT\nEND:VCALENDAR"), "invalid_event_range");
  await rejectsCode(() => parseICalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20260901\nEND:VEVENT\nEND:VCALENDAR"), "invalid_event");
  await rejectsCode(() => parseICalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20260101\nDTEND;VALUE=DATE:20270103\nEND:VEVENT\nEND:VCALENDAR"), "event_day_limit_exceeded");
  await rejectsCode(() => parseICalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20260901\nDTEND;VALUE=DATE:20260902\nRRULE:FREQ=DAILY;COUNT=2\nEND:VEVENT\nEND:VCALENDAR"), "unsupported_event_recurrence");
});

Deno.test("blocks localhost, private DNS, link-local, non-HTTPS and unsafe redirects", async () => {
  for (const url of [
    "http://example.com/feed.ics",
    "https://localhost/feed.ics",
    "https://127.0.0.1/feed.ics",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/feed.ics",
    "https://[fe80::1]/feed.ics",
    "https://user:secret@example.com/feed.ics",
  ]) await rejectsCode(() => assertSafeHttpsUrl(url, resolvePublic), url.startsWith("http:") || url.includes("user:") ? "unsafe_calendar_url" : "unsafe_calendar_host");
  await rejectsCode(() => assertSafeHttpsUrl("https://calendar.example/feed.ics", async (_host, type) => type === "A" ? ["10.0.0.8"] : []), "unsafe_calendar_host");
  const observations = { targets: [] as PinnedHttpsTarget[], requests: [] as string[], closes: 0 };
  await rejectsCode(() => fetchCalendar("https://calendar.example/feed.ics", {
    resolve: resolvePublic,
    connect: fakeConnector(() => rawResponse("", { status: 302, headers: { location: "https://127.0.0.1/private" } }), observations),
  }), "unsafe_calendar_host");
  assert(observations.closes === 1, "The redirect response socket must be closed before rejection");
});

Deno.test("bounds a hanging DNS resolver by the shared fetch deadline", async () => {
  const never = new Promise<string[]>(() => {});
  const started = Date.now();
  await rejectsCode(
    () => assertSafeHttpsUrl("https://calendar.example/feed.ics", async () => await never, Date.now() + 20),
    "calendar_fetch_timeout",
  );
  assert(Date.now() - started < 500, "DNS resolution must not outlive the explicit deadline");
});

Deno.test("fetches a bounded public HTTPS calendar and rejects an oversized body", async () => {
  const body = "BEGIN:VCALENDAR\nEND:VCALENDAR";
  const observations = { targets: [] as PinnedHttpsTarget[], requests: [] as string[], closes: 0 };
  const result = await fetchCalendar("https://calendar.example/feed.ics", {
    resolve: resolvePublic,
    connect: fakeConnector(() => rawResponse(body), observations),
  });
  assert(result.text === body && result.httpStatus === 200);
  assert(observations.targets[0].address === "93.184.216.34" && observations.targets[0].hostname === "calendar.example");
  assert(observations.requests[0].includes("Host: calendar.example\r\n"));
  assert(observations.requests[0].includes("Accept-Encoding: identity\r\n"));
  await rejectsCode(() => fetchCalendar("https://calendar.example/feed.ics", {
    resolve: resolvePublic,
    connect: fakeConnector(() => rawResponse("", { headers: { "content-length": String(LIMITS.responseBytes + 1) } }), observations),
  }), "calendar_payload_too_large");
});

Deno.test("pins the vetted address across the TLS request and revalidates every redirect", async () => {
  const observations = { targets: [] as PinnedHttpsTarget[], requests: [] as string[], closes: 0 };
  let firstDnsAnswer = true;
  const resolve = async (hostname: string, type: "A" | "AAAA") => {
    if (type === "AAAA") return [];
    if (hostname === "calendar.example") {
      const answer = firstDnsAnswer ? "93.184.216.34" : "10.0.0.8";
      firstDnsAnswer = false;
      return [answer];
    }
    return ["93.184.216.35"];
  };
  const result = await fetchCalendar("https://calendar.example/start.ics", {
    resolve,
    connect: fakeConnector((target) => target.hostname === "calendar.example"
      ? rawResponse("", { status: 302, headers: { location: "https://redirect.example/final.ics" } })
      : rawResponse("BEGIN:VCALENDAR\nEND:VCALENDAR", { framing: "chunked" }), observations, 3),
  });
  assert(result.httpStatus === 200);
  assert(observations.targets.map((target) => target.address).join(",") === "93.184.216.34,93.184.216.35");
  assert(observations.requests[0].startsWith("GET /start.ics HTTP/1.1\r\nHost: calendar.example\r\n"));
  assert(observations.requests[1].startsWith("GET /final.ics HTTP/1.1\r\nHost: redirect.example\r\n"));
});

Deno.test("supports chunked and connection-close framing and rejects ambiguous or encoded bodies", async () => {
  const body = "BEGIN:VCALENDAR\nEND:VCALENDAR";
  for (const framing of ["chunked", "close"] as const) {
    const observations = { targets: [] as PinnedHttpsTarget[], requests: [] as string[], closes: 0 };
    const result = await fetchCalendar("https://calendar.example/feed.ics", {
      resolve: resolvePublic,
      connect: fakeConnector(() => rawResponse(body, { framing }), observations, 1),
    });
    assert(result.text === body && observations.closes === 1);
  }
  for (const response of [
    encoder.encode("HTTP/1.1 200 OK\r\nContent-Length: 1\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n"),
    rawResponse(body, { headers: { "content-encoding": "gzip" } }),
    encoder.encode("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nZ\r\nbad\r\n0\r\n\r\n"),
  ]) {
    const observations = { targets: [] as PinnedHttpsTarget[], requests: [] as string[], closes: 0 };
    await rejectsCode(() => fetchCalendar("https://calendar.example/feed.ics", {
      resolve: resolvePublic,
      connect: fakeConnector(() => response, observations),
    }), "invalid_calendar_http_response");
    assert(observations.closes === 1);
  }
});

Deno.test("closes a non-success provider socket before rejecting it", async () => {
  const observations = { targets: [] as PinnedHttpsTarget[], requests: [] as string[], closes: 0 };
  await rejectsCode(() => fetchCalendar("https://calendar.example/feed.ics", {
    resolve: resolvePublic,
    connect: fakeConnector(() => rawResponse("provider secret", { status: 503, headers: { "content-type": "text/plain" } }), observations),
  }), "calendar_http_failure");
  assert(observations.closes === 1, "A rejected provider socket must be closed mechanically");
});

Deno.test("sanitized failures never echo unknown provider details", () => {
  const unknown = sanitizeFailure(new Error("https://secret.example/raw.ics UID:private"));
  assert(unknown.error_code === "worker_failure");
  assert(!JSON.stringify(unknown).includes("secret.example"));
  const known = sanitizeFailure(new WorkerError("calendar_http_failure", "The calendar provider returned a non-success status.", 503));
  assert(known.http_status === 503 && known.error_code === "calendar_http_failure");
});
