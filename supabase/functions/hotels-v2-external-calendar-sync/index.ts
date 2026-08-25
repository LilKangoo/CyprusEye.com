import {
  CONTRACTS,
  fetchCalendar,
  type LeaseJob,
  LIMITS,
  parseBeginResult,
  parseFailResult,
  parseFinalizeResult,
  parseICalendar,
  parseSchedulerEnqueueResult,
  parseSchedulerLeaseResult,
  parseSourceContract,
  parseWorkerRequest,
  sanitizeFailure,
  sha256,
  WorkerError,
} from "./core.ts";

const RPC_NAMES = Object.freeze({
  getSource: "hotel_v2_external_calendar_worker_get_source",
  enqueue: "hotel_v2_external_calendar_scheduler_enqueue",
  lease: "hotel_v2_external_calendar_scheduler_lease",
  begin: "hotel_v2_external_calendar_worker_begin_sync",
  finalize: "hotel_v2_external_calendar_worker_finalize_sync",
  fail: "hotel_v2_external_calendar_worker_fail_sync",
});

const RPC_ALLOWLIST = new Set(Object.values(RPC_NAMES));
const LEASE_SECONDS = 180;
const CONCURRENCY = 4;

type Environment = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  HOTELS_V2_ICAL_SYNC_SECRET: string;
};

type RpcClient = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type JobResult = {
  job_id: string;
  source_id: string;
  attempt_id: string;
  status: "succeeded" | "failed" | "ambiguous";
  error_code: string | null;
  failure_recorded: boolean;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function readEnvironment(): Environment {
  return {
    SUPABASE_URL: (Deno.env.get("SUPABASE_URL") || "").trim(),
    SUPABASE_SERVICE_ROLE_KEY: (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim(),
    HOTELS_V2_ICAL_SYNC_SECRET: (Deno.env.get("HOTELS_V2_ICAL_SYNC_SECRET") || "").trim(),
  };
}

async function timingSafeStringEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = leftHash.length ^ rightHash.length;
  for (let index = 0; index < Math.max(leftHash.length, rightHash.length); index += 1) {
    difference |= (leftHash.charCodeAt(index) || 0) ^ (rightHash.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function authorized(request: Request, environment: Environment): Promise<boolean> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] || "";
  const internalSecret = request.headers.get("x-hotels-v2-ical-sync-secret") || "";
  const bearerOk = Boolean(environment.SUPABASE_SERVICE_ROLE_KEY && bearer)
    && await timingSafeStringEqual(bearer, environment.SUPABASE_SERVICE_ROLE_KEY);
  const secretOk = Boolean(environment.HOTELS_V2_ICAL_SYNC_SECRET && internalSecret)
    && await timingSafeStringEqual(internalSecret, environment.HOTELS_V2_ICAL_SYNC_SECRET);
  return bearerOk || secretOk;
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = (request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new WorkerError("invalid_request", "The worker request must be JSON.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > LIMITS.requestBytes)) {
    throw new WorkerError("request_too_large", "The worker request exceeds 16 KiB.");
  }
  if (!request.body) throw new WorkerError("invalid_request", "The worker request body is required.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITS.requestBytes) {
      await reader.cancel();
      throw new WorkerError("request_too_large", "The worker request exceeds 16 KiB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new WorkerError("invalid_request", "The worker request body is not valid JSON.");
  }
}

function createRpcClient(environment: Environment, fetchImpl: typeof fetch): RpcClient {
  let base: URL;
  try { base = new URL(environment.SUPABASE_URL); } catch { throw new WorkerError("worker_configuration_error", "The worker configuration is incomplete."); }
  if (base.protocol !== "https:" || !environment.SUPABASE_SERVICE_ROLE_KEY) {
    throw new WorkerError("worker_configuration_error", "The worker configuration is incomplete.");
  }
  return async (name, args) => {
    if (!RPC_ALLOWLIST.has(name)) throw new WorkerError("rpc_not_allowed", "The requested worker RPC is not allowed.");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), LIMITS.rpcTimeoutMs);
    let response: Response; let text: string;
    try {
      response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, base), {
        method: "POST",
        signal: controller.signal,
        headers: {
          apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(args),
      });
      const declared = response.headers.get("content-length");
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > LIMITS.responseBytes)) {
        throw new WorkerError("invalid_worker_rpc_response", "The worker database response exceeded its bound.", response.status);
      }
      text = await response.text();
      if (new TextEncoder().encode(text).length > LIMITS.responseBytes) {
        throw new WorkerError("invalid_worker_rpc_response", "The worker database response exceeded its bound.", response.status);
      }
    } catch (error) {
      if (error instanceof WorkerError) throw error;
      throw new WorkerError("worker_rpc_unavailable", "The worker database operation was unavailable.");
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      let code = "worker_rpc_failure";
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.message === "string" && /^hotels_v2_external_calendar_[a-z0-9_]{1,100}$/.test(parsed.message)) code = parsed.message;
      } catch { /* Deliberately do not surface the raw PostgREST body. */ }
      throw new WorkerError(code, "The worker database operation failed.", response.status);
    }
    try { return JSON.parse(text); }
    catch { throw new WorkerError("invalid_worker_rpc_response", "The worker database operation returned invalid JSON.", response.status); }
  };
}

async function resolveDns(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  return type === "A" ? await Deno.resolveDns(hostname, "A") : await Deno.resolveDns(hostname, "AAAA");
}

function topology(job: LeaseJob, attemptId: string, startedAt: string) {
  return {
    job_id: job.job_id,
    lease_token: job.lease_token,
    source_id: job.source_id,
    hotel_id: job.hotel_id,
    room_type_id: job.room_type_id,
    source_version: job.source_version,
    binding_version: job.binding_version,
    trigger_type: job.trigger_type,
    attempt_id: attemptId,
    started_at: startedAt,
  };
}

async function processJob(job: LeaseJob, rpc: RpcClient, fetchImpl: typeof fetch): Promise<JobResult> {
  const attemptId = crypto.randomUUID(); const startedAt = new Date().toISOString();
  const identity = { attempt_id: attemptId, job_id: job.job_id, source_id: job.source_id };
  const common = topology(job, attemptId, startedAt);
  if (Date.parse(job.leased_until) <= Date.now()) {
    return { job_id: job.job_id, source_id: job.source_id, attempt_id: attemptId, status: "failed", error_code: "job_lease_expired", failure_recorded: false };
  }

  try {
    parseBeginResult(await rpc(RPC_NAMES.begin, { p_payload: { contract_version: CONTRACTS.begin, ...common } }), identity);
  } catch (error) {
    const failure = sanitizeFailure(error);
    return { job_id: job.job_id, source_id: job.source_id, attempt_id: attemptId, status: "ambiguous", error_code: failure.error_code, failure_recorded: false };
  }

  let parsed: Awaited<ReturnType<typeof parseICalendar>>; let httpStatus: number;
  try {
    const source = parseSourceContract(await rpc(RPC_NAMES.getSource, { p_source_id: job.source_id }));
    if (source.source_id !== job.source_id || source.hotel_id !== job.hotel_id
        || source.room_type_id !== job.room_type_id || source.source_version !== job.source_version
        || source.binding_version !== job.binding_version || !source.is_enabled
        || source.review_status !== "reviewed" || !source.hotel_external_sync_enabled) {
      throw new WorkerError("source_state_changed", "The calendar source changed after the job was leased.");
    }
    const fetched = await fetchCalendar(source.ical_url, { fetchImpl, resolve: resolveDns });
    httpStatus = fetched.httpStatus;
    parsed = await parseICalendar(fetched.text, source.hotel_timezone);
  } catch (error) {
    const failure = sanitizeFailure(error); const finishedAt = new Date().toISOString();
    try {
      parseFailResult(await rpc(RPC_NAMES.fail, { p_payload: {
        contract_version: CONTRACTS.fail,
        ...common,
        finished_at: finishedAt,
        http_status: failure.http_status,
        error_code: failure.error_code,
        error_message: failure.error_message,
      } }), identity);
      return { job_id: job.job_id, source_id: job.source_id, attempt_id: attemptId, status: "failed", error_code: failure.error_code, failure_recorded: true };
    } catch {
      return { job_id: job.job_id, source_id: job.source_id, attempt_id: attemptId, status: "ambiguous", error_code: "failure_receipt_ambiguous", failure_recorded: false };
    }
  }

  try {
    parseFinalizeResult(await rpc(RPC_NAMES.finalize, { p_payload: {
      contract_version: CONTRACTS.finalize,
      ...common,
      finished_at: new Date().toISOString(),
      http_status: httpStatus,
      content_fingerprint: parsed.content_fingerprint,
      events: parsed.events,
    } }), identity);
    return { job_id: job.job_id, source_id: job.source_id, attempt_id: attemptId, status: "succeeded", error_code: null, failure_recorded: false };
  } catch {
    return { job_id: job.job_id, source_id: job.source_id, attempt_id: attemptId, status: "ambiguous", error_code: "finalize_receipt_ambiguous", failure_recorded: false };
  }
}

async function processBounded(jobs: LeaseJob[], rpc: RpcClient, fetchImpl: typeof fetch): Promise<JobResult[]> {
  const results: JobResult[] = [];
  for (let index = 0; index < jobs.length; index += CONCURRENCY) {
    results.push(...await Promise.all(jobs.slice(index, index + CONCURRENCY).map((job) => processJob(job, rpc, fetchImpl))));
  }
  return results;
}

export async function handleRequest(
  request: Request,
  dependencies: { environment?: Environment; fetchImpl?: typeof fetch; rpc?: RpcClient } = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const environment = dependencies.environment || readEnvironment();
  if (!await authorized(request, environment)) return json({ error: "unauthorized" }, 401);
  try {
    const workerRequest = parseWorkerRequest(await readBoundedJson(request));
    const fetchImpl = dependencies.fetchImpl || fetch;
    const rpc = dependencies.rpc || createRpcClient(environment, fetchImpl);
    let queuedCount = 0;
    if (workerRequest.enqueue_scheduled) {
      const enqueue = parseSchedulerEnqueueResult(await rpc(RPC_NAMES.enqueue, { p_limit: workerRequest.limit }));
      queuedCount = enqueue.queued_count;
      if (!enqueue.global_enabled) return json({
        contract_version: CONTRACTS.response,
        global_enabled: false,
        queued_count: 0,
        leased_count: 0,
        succeeded_count: 0,
        failed_count: 0,
        ambiguous_count: 0,
        results: [],
      });
    }
    const leaseOwner = crypto.randomUUID();
    const lease = parseSchedulerLeaseResult(await rpc(RPC_NAMES.lease, {
      p_limit: workerRequest.limit,
      p_lease_owner: leaseOwner,
      p_lease_seconds: LEASE_SECONDS,
    }));
    if (lease.jobs.length > workerRequest.limit) throw new WorkerError("invalid_scheduler_lease_contract", "The scheduler leased too many jobs.");
    const results = lease.global_enabled ? await processBounded(lease.jobs, rpc, fetchImpl) : [];
    return json({
      contract_version: CONTRACTS.response,
      global_enabled: lease.global_enabled,
      queued_count: queuedCount,
      leased_count: results.length,
      succeeded_count: results.filter((result) => result.status === "succeeded").length,
      failed_count: results.filter((result) => result.status === "failed").length,
      ambiguous_count: results.filter((result) => result.status === "ambiguous").length,
      results,
    });
  } catch (error) {
    const failure = sanitizeFailure(error);
    const status = error instanceof WorkerError && error.code === "request_too_large"
      ? 413
      : error instanceof WorkerError && error.code === "invalid_request" ? 400 : 500;
    return json({ error: failure.error_code, message: failure.error_message }, status);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
