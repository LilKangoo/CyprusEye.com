import { CONTRACTS } from "./core.ts";
import { handleRequest } from "./index.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
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
    fetchImpl: async () => new Response([
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:private-provider-id",
      "DTSTART:20260901T220000Z", "DTEND:20260902T210000Z", "END:VEVENT", "END:VCALENDAR",
    ].join("\n"), { status: 200, headers: { "content-type": "text/calendar" } }),
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
    fetchImpl: async (input) => String(input).includes("bad.ics")
      ? new Response("provider secret body", { status: 502, headers: { "content-type": "text/plain" } })
      : new Response("BEGIN:VCALENDAR\nEND:VCALENDAR", { status: 200, headers: { "content-type": "text/calendar" } }),
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
  let fetchCount = 0;
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
    fetchImpl: async () => { fetchCount += 1; return new Response("unexpected"); },
  });
  const body = await response.json();
  assert(response.status === 200 && body.failed_count === 1 && body.results[0].error_code === "source_state_changed");
  assert(fetchCount === 0, "A disabled source must never reach the network");
});
