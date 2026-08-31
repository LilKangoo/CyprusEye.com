import { CONTRACTS, type PinnedConnector, type PinnedHttpsTarget } from "./core.ts";
import { handleRequest } from "./index.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

const encoder = new TextEncoder();

function rawResponse(body: string, status = 200, contentType = "text/calendar"): Uint8Array {
  const bytes = encoder.encode(body);
  const head = encoder.encode([
    `HTTP/1.1 ${status} ${status === 200 ? "OK" : "Status"}`,
    `Content-Type: ${contentType}`,
    `Content-Length: ${bytes.length}`,
    "", "",
  ].join("\r\n"));
  const result = new Uint8Array(head.length + bytes.length);
  result.set(head); result.set(bytes, head.length);
  return result;
}

function calendarConnector(responseFor: (target: PinnedHttpsTarget) => Uint8Array): PinnedConnector {
  return async (target) => {
    const response = responseFor(target); let offset = 0; let closed = false;
    return {
      async read(buffer: Uint8Array) {
        if (closed || offset >= response.length) return null;
        const count = Math.min(buffer.length, response.length - offset);
        buffer.set(response.subarray(offset, offset + count)); offset += count;
        return count;
      },
      async write(buffer: Uint8Array) { return buffer.length; },
      close() { closed = true; },
    };
  };
}

const environment = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-secret",
  HOTELS_V2_ICAL_SYNC_SECRET: "worker-test-secret",
};

function workerRequest(body: unknown, secret = environment.HOTELS_V2_ICAL_SYNC_SECRET): Request {
  return new Request("https://project.supabase.co/functions/v1/hotels-v2-external-calendar-sync", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hotels-v2-ical-sync-secret": secret },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects browser and unauthenticated worker requests", async () => {
  const response = await handleRequest(workerRequest({ contract_version: CONTRACTS.request, enqueue_scheduled: false, limit: 1 }, "wrong"), { environment });
  assert(response.status === 401);
  assert(response.headers.get("access-control-allow-origin") === null);
});

Deno.test("leases, begins, Hotel-localizes and finalizes through allowlisted RPCs only", async () => {
  const job = {
    job_id: "11111111-1111-4111-8111-111111111111",
    source_id: "22222222-2222-4222-8222-222222222222",
    hotel_id: "33333333-3333-4333-8333-333333333333",
    room_type_id: "44444444-4444-4444-8444-444444444444",
    source_version: 2,
    binding_version: 3,
    trigger_type: "scheduled",
    lease_token: "55555555-5555-4555-8555-555555555555",
    leased_until: "2199-01-01T00:00:00+00:00",
  };
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpc = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    calls.push({ name, args });
    if (name.endsWith("scheduler_enqueue")) return { contract_version: CONTRACTS.schedulerEnqueue, global_enabled: true, queued_count: 1 };
    if (name.endsWith("scheduler_lease")) return { contract_version: CONTRACTS.schedulerLease, global_enabled: true, jobs: [job] };
    if (name.endsWith("worker_begin_sync")) {
      const payload = args.p_payload as Record<string, unknown>;
      return { contract_version: CONTRACTS.beginResult, attempt_id: payload.attempt_id, job_id: job.job_id, source_id: job.source_id, status: "running", replayed: false };
    }
    if (name.endsWith("worker_get_source")) return {
      contract_version: CONTRACTS.source,
      source_id: job.source_id,
      hotel_id: job.hotel_id,
      room_type_id: job.room_type_id,
      source_type: "ical",
      source_version: job.source_version,
      binding_version: job.binding_version,
      is_enabled: true,
      review_status: "reviewed",
      hotel_external_sync_enabled: true,
      hotel_timezone: "Europe/Nicosia",
      ical_url: "https://93.184.216.34/calendar.ics",
    };
    if (name.endsWith("worker_finalize_sync")) {
      const payload = args.p_payload as Record<string, unknown>;
      const events = payload.events as Array<Record<string, unknown>>;
      assert(events[0].starts_on === "2026-09-02" && events[0].ends_on === "2026-09-03");
      return {
        contract_version: CONTRACTS.finalizeResult,
        attempt_id: payload.attempt_id,
        job_id: job.job_id,
        source_id: job.source_id,
        status: "succeeded",
        event_count: 1,
        active_event_count: 1,
        active_day_block_count: 1,
        replayed: false,
      };
    }
    throw new Error(`Unexpected RPC ${name}`);
  };
  const response = await handleRequest(workerRequest({ contract_version: CONTRACTS.request, enqueue_scheduled: true, limit: 1 }), {
    environment,
    rpc,
    calendarConnect: calendarConnector(() => rawResponse([
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:private-provider-id",
      "DTSTART:20260901T220000Z", "DTEND:20260902T210000Z", "END:VEVENT", "END:VCALENDAR",
    ].join("\n"))),
  });
  const body = await response.json();
  assert(response.status === 200 && body.succeeded_count === 1 && body.failed_count === 0);
  assert(JSON.stringify(body).includes("private-provider-id") === false);
  assert(calls.every((call) => call.name.startsWith("hotel_v2_external_calendar_")));
  const leaseCall = calls.find((call) => call.name.endsWith("scheduler_lease"))!;
  assert(leaseCall.args.p_lease_seconds === 180, "The bounded two-wave dispatch requires a 180-second lease");
});

Deno.test("isolates a bad feed and records only its sanitized failure", async () => {
  const jobs = ["1", "2"].map((suffix, index) => ({
    job_id: `${suffix.repeat(8)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-8${suffix.repeat(3)}-${suffix.repeat(12)}`,
    source_id: `${String(index + 3).repeat(8)}-${String(index + 3).repeat(4)}-4${String(index + 3).repeat(3)}-8${String(index + 3).repeat(3)}-${String(index + 3).repeat(12)}`,
    hotel_id: "55555555-5555-4555-8555-555555555555",
    room_type_id: "66666666-6666-4666-8666-666666666666",
    source_version: 1,
    binding_version: 1,
    trigger_type: "retry",
    lease_token: `${String(index + 7).repeat(8)}-${String(index + 7).repeat(4)}-4${String(index + 7).repeat(3)}-8${String(index + 7).repeat(3)}-${String(index + 7).repeat(12)}`,
    leased_until: "2199-01-01T00:00:00Z",
  }));
  const rpc = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    if (name.endsWith("scheduler_lease")) return { contract_version: CONTRACTS.schedulerLease, global_enabled: true, jobs };
    const payload = args.p_payload as Record<string, unknown> | undefined;
    const sourceId = String(payload?.source_id || args.p_source_id);
    const job = jobs.find((item) => item.source_id === sourceId)!;
    if (name.endsWith("worker_begin_sync")) return { contract_version: CONTRACTS.beginResult, attempt_id: payload!.attempt_id, job_id: job.job_id, source_id: sourceId, status: "running", replayed: false };
    if (name.endsWith("worker_get_source")) return {
      contract_version: CONTRACTS.source, source_id: sourceId, hotel_id: job.hotel_id, room_type_id: job.room_type_id,
      source_type: "ical", source_version: 1, binding_version: 1, is_enabled: true, review_status: "reviewed",
      hotel_external_sync_enabled: true, hotel_timezone: "Europe/Nicosia",
      ical_url: sourceId === jobs[0].source_id ? "https://93.184.216.34/bad.ics" : "https://93.184.216.35/good.ics",
    };
    if (name.endsWith("worker_fail_sync")) return {
      contract_version: CONTRACTS.failResult, attempt_id: payload!.attempt_id, job_id: job.job_id,
      source_id: sourceId, status: "failed", next_retry_at: "2026-08-25T13:00:00+00:00", replayed: false,
    };
    if (name.endsWith("worker_finalize_sync")) return {
      contract_version: CONTRACTS.finalizeResult, attempt_id: payload!.attempt_id, job_id: job.job_id,
      source_id: sourceId, status: "succeeded", event_count: 0, active_event_count: 0, active_day_block_count: 0, replayed: false,
    };
    throw new Error(`Unexpected RPC ${name}`);
  };
  const response = await handleRequest(workerRequest({ contract_version: CONTRACTS.request, enqueue_scheduled: false, limit: 2 }), {
    environment,
    rpc,
    calendarConnect: calendarConnector((target) => target.url.pathname.includes("bad.ics")
      ? rawResponse("provider secret body", 502, "text/plain")
      : rawResponse("BEGIN:VCALENDAR\nEND:VCALENDAR")),
  });
  const body = await response.json();
  assert(body.failed_count === 1 && body.succeeded_count === 1);
  assert(JSON.stringify(body).includes("provider secret body") === false);
});

Deno.test("never fetches a source that becomes disabled after lease", async () => {
  const job = {
    job_id: "11111111-1111-4111-8111-111111111111",
    source_id: "22222222-2222-4222-8222-222222222222",
    hotel_id: "33333333-3333-4333-8333-333333333333",
    room_type_id: "44444444-4444-4444-8444-444444444444",
    source_version: 1,
    binding_version: 1,
    trigger_type: "manual",
    lease_token: "55555555-5555-4555-8555-555555555555",
    leased_until: "2199-01-01T00:00:00Z",
  };
  let connectCount = 0;
  const rpc = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    if (name.endsWith("scheduler_lease")) return { contract_version: CONTRACTS.schedulerLease, global_enabled: true, jobs: [job] };
    const payload = args.p_payload as Record<string, unknown> | undefined;
    if (name.endsWith("worker_begin_sync")) return {
      contract_version: CONTRACTS.beginResult, attempt_id: payload!.attempt_id, job_id: job.job_id,
      source_id: job.source_id, status: "running", replayed: false,
    };
    if (name.endsWith("worker_get_source")) return {
      contract_version: CONTRACTS.source, source_id: job.source_id, hotel_id: job.hotel_id,
      room_type_id: job.room_type_id, source_type: "ical", source_version: 1, binding_version: 1,
      is_enabled: false, review_status: "reviewed", hotel_external_sync_enabled: true,
      hotel_timezone: "Europe/Nicosia", ical_url: "https://93.184.216.34/never-fetch.ics",
    };
    if (name.endsWith("worker_fail_sync")) return {
      contract_version: CONTRACTS.failResult, attempt_id: payload!.attempt_id, job_id: job.job_id,
      source_id: job.source_id, status: "failed", next_retry_at: "2026-08-25T13:00:00Z", replayed: false,
    };
    throw new Error(`Unexpected RPC ${name}`);
  };
  const response = await handleRequest(workerRequest({ contract_version: CONTRACTS.request, enqueue_scheduled: false, limit: 1 }), {
    environment,
    rpc,
    calendarConnect: async () => { connectCount += 1; throw new Error("unexpected"); },
  });
  const body = await response.json();
  assert(response.status === 200 && body.failed_count === 1 && body.results[0].error_code === "source_state_changed");
  assert(connectCount === 0, "A disabled source must never reach the network");
});

Deno.test("never fetches a source whose exact Room mapping changes after lease", async () => {
  const job = {
    job_id: "11111111-1111-4111-8111-111111111111",
    source_id: "22222222-2222-4222-8222-222222222222",
    hotel_id: "9b6d99a0-923a-4fbc-be54-c066e856e6ca",
    room_type_id: "b4ef504f-cdeb-4e3c-a54d-932146ef4e94",
    source_version: 1,
    binding_version: 1,
    trigger_type: "manual",
    lease_token: "55555555-5555-4555-8555-555555555555",
    leased_until: "2199-01-01T00:00:00Z",
  };
  let connectCount = 0;
  const rpc = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    if (name.endsWith("scheduler_lease")) {
      return { contract_version: CONTRACTS.schedulerLease, global_enabled: true, jobs: [job] };
    }
    const payload = args.p_payload as Record<string, unknown> | undefined;
    if (name.endsWith("worker_begin_sync")) {
      return {
        contract_version: CONTRACTS.beginResult,
        attempt_id: payload!.attempt_id,
        job_id: job.job_id,
        source_id: job.source_id,
        status: "running",
        replayed: false,
      };
    }
    if (name.endsWith("worker_get_source")) {
      return {
        contract_version: CONTRACTS.source,
        source_id: job.source_id,
        hotel_id: job.hotel_id,
        room_type_id: "825c01b7-9f82-492a-9c81-9b1d5cd7acd3",
        source_type: "airbnb",
        source_version: 1,
        binding_version: 1,
        is_enabled: true,
        review_status: "reviewed",
        hotel_external_sync_enabled: true,
        hotel_timezone: "Europe/Nicosia",
        ical_url: "https://93.184.216.34/never-fetch.ics",
      };
    }
    if (name.endsWith("worker_fail_sync")) {
      return {
        contract_version: CONTRACTS.failResult,
        attempt_id: payload!.attempt_id,
        job_id: job.job_id,
        source_id: job.source_id,
        status: "failed",
        next_retry_at: "2026-08-30T13:00:00Z",
        replayed: false,
      };
    }
    throw new Error(`Unexpected RPC ${name}`);
  };
  const response = await handleRequest(
    workerRequest({ contract_version: CONTRACTS.request, enqueue_scheduled: false, limit: 1 }),
    {
      environment,
      rpc,
      calendarConnect: async () => { connectCount += 1; throw new Error("unexpected"); },
    },
  );
  const body = await response.json();
  assert(response.status === 200 && body.failed_count === 1);
  assert(body.results[0].error_code === "source_state_changed" && body.results[0].failure_recorded === true);
  assert(connectCount === 0, "A remapped source must never reach the network");
});

Deno.test("processes Booking.com, Airbnb and Generic iCal local fixtures without provider-specific transport", async () => {
  const providers = ["booking_com", "airbnb", "ical"] as const;
  const rooms = [
    "b4ef504f-cdeb-4e3c-a54d-932146ef4e94",
    "825c01b7-9f82-492a-9c81-9b1d5cd7acd3",
    "b4ef504f-cdeb-4e3c-a54d-932146ef4e94",
  ];
  const jobs = providers.map((provider, index) => ({
    job_id: `${index + 1}${String(index + 1).repeat(7)}-${String(index + 1).repeat(4)}-4${String(index + 1).repeat(3)}-8${String(index + 1).repeat(3)}-${String(index + 1).repeat(12)}`,
    source_id: `${index + 4}${String(index + 4).repeat(7)}-${String(index + 4).repeat(4)}-4${String(index + 4).repeat(3)}-8${String(index + 4).repeat(3)}-${String(index + 4).repeat(12)}`,
    hotel_id: "9b6d99a0-923a-4fbc-be54-c066e856e6ca",
    room_type_id: rooms[index],
    source_version: 2,
    binding_version: 3,
    trigger_type: index === 2 ? "retry" : "manual",
    lease_token: `${index + 7}${String(index + 7).repeat(7)}-${String(index + 7).repeat(4)}-4${String(index + 7).repeat(3)}-8${String(index + 7).repeat(3)}-${String(index + 7).repeat(12)}`,
    leased_until: "2199-01-01T00:00:00Z",
    provider,
  }));
  const fixtures: Record<string, string> = {
    booking_com: [
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:booking-private-id",
      "DTSTART;VALUE=DATE:20260901", "DTEND;VALUE=DATE:20260903",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\n"),
    airbnb: [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT", "UID:airbnb-private-id-a", "DTSTART;VALUE=DATE:20260904", "DTEND;VALUE=DATE:20260907", "END:VEVENT",
      "BEGIN:VEVENT", "UID:airbnb-private-id-b", "DTSTART;VALUE=DATE:20260906", "DTEND;VALUE=DATE:20260908", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"),
    ical: [
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:ical-private-id",
      "DTSTART;VALUE=DATE:20260909", "DTEND;VALUE=DATE:20260910", "STATUS:CANCELLED",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\n"),
  };
  const finalized = new Map<string, Array<Record<string, unknown>>>();
  for (const jobWithProvider of jobs) {
    const { provider, ...job } = jobWithProvider;
    const rpc = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      if (name.endsWith("scheduler_lease")) {
        return { contract_version: CONTRACTS.schedulerLease, global_enabled: true, jobs: [job] };
      }
      const payload = args.p_payload as Record<string, unknown> | undefined;
      if (name.endsWith("worker_begin_sync")) {
        return {
          contract_version: CONTRACTS.beginResult,
          attempt_id: payload!.attempt_id,
          job_id: job.job_id,
          source_id: job.source_id,
          status: "running",
          replayed: false,
        };
      }
      if (name.endsWith("worker_get_source")) {
        return {
          contract_version: CONTRACTS.source,
          source_id: job.source_id,
          hotel_id: job.hotel_id,
          room_type_id: job.room_type_id,
          source_type: provider,
          source_version: job.source_version,
          binding_version: job.binding_version,
          is_enabled: true,
          review_status: "reviewed",
          hotel_external_sync_enabled: true,
          hotel_timezone: "Europe/Nicosia",
          ical_url: `https://93.184.216.${34 + providers.indexOf(provider)}/${provider}.ics`,
        };
      }
      if (name.endsWith("worker_finalize_sync")) {
        const events = payload!.events as Array<Record<string, unknown>>;
        finalized.set(provider, events);
        return {
          contract_version: CONTRACTS.finalizeResult,
          attempt_id: payload!.attempt_id,
          job_id: job.job_id,
          source_id: job.source_id,
          status: "succeeded",
          event_count: events.length,
          active_event_count: events.filter((event) => event.event_status === "active").length,
          active_day_block_count: events
            .filter((event) => event.event_status === "active")
            .reduce((total, event) => total + Math.round(
              (Date.parse(`${event.ends_on}T00:00:00.000Z`)
                - Date.parse(`${event.starts_on}T00:00:00.000Z`)) / 86_400_000,
            ), 0),
          replayed: false,
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    };
    const response = await handleRequest(
      workerRequest({ contract_version: CONTRACTS.request, enqueue_scheduled: false, limit: 1 }),
      {
        environment,
        rpc,
        calendarConnect: calendarConnector(() => rawResponse(fixtures[provider])),
      },
    );
    const body = await response.json();
    assert(response.status === 200 && body.succeeded_count === 1 && body.failed_count === 0);
    assert(!JSON.stringify(body).includes("private-id"), "Worker responses must never expose provider identities");
  }
  assert(finalized.get("booking_com")?.length === 1);
  assert(finalized.get("airbnb")?.length === 2, "Overlapping provider events remain exact independent events");
  assert(finalized.get("ical")?.[0].event_status === "cancelled");
});

Deno.test("contains an expired lease without beginning, fetching or recording a stale attempt", async () => {
  const job = {
    job_id: "11111111-1111-4111-8111-111111111111",
    source_id: "22222222-2222-4222-8222-222222222222",
    hotel_id: "33333333-3333-4333-8333-333333333333",
    room_type_id: "44444444-4444-4444-8444-444444444444",
    source_version: 1,
    binding_version: 1,
    trigger_type: "retry",
    lease_token: "55555555-5555-4555-8555-555555555555",
    leased_until: "2000-01-01T00:00:00Z",
  };
  const calls: string[] = [];
  const response = await handleRequest(
    workerRequest({ contract_version: CONTRACTS.request, enqueue_scheduled: false, limit: 1 }),
    {
      environment,
      rpc: async (name) => {
        calls.push(name);
        if (name.endsWith("scheduler_lease")) {
          return { contract_version: CONTRACTS.schedulerLease, global_enabled: true, jobs: [job] };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
      calendarConnect: async () => { throw new Error("An expired lease must not fetch"); },
    },
  );
  const body = await response.json();
  assert(response.status === 200 && body.failed_count === 1);
  assert(body.results[0].error_code === "job_lease_expired" && body.results[0].failure_recorded === false);
  assert(calls.length === 1 && calls[0].endsWith("scheduler_lease"));
});
