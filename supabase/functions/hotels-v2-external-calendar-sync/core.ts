export const LIMITS = Object.freeze({
  requestBytes: 16 * 1024,
  responseBytes: 2 * 1024 * 1024,
  responseHeaderBytes: 64 * 1024,
  responseWireOverheadBytes: 256 * 1024,
  redirects: 3,
  timeoutMs: 8_000,
  rpcTimeoutMs: 15_000,
  sources: 25,
  events: 500,
  daysPerEvent: 366,
  totalActiveDays: 50_000,
  unfoldedLines: 20_000,
  unfoldedLineBytes: 8_192,
  urlCharacters: 4_096,
});

export const CONTRACTS = Object.freeze({
  request: "hotels_v2_external_calendar_worker_request_v1",
  source: "hotels_v2_external_calendar_worker_source_v2",
  sourceList: "hotels_v2_external_calendar_worker_source_list_v1",
  schedulerEnqueue: "hotels_v2_external_calendar_scheduler_enqueue_v1",
  schedulerLease: "hotels_v2_external_calendar_scheduler_lease_v1",
  begin: "hotels_v2_external_calendar_worker_begin_v1",
  beginResult: "hotels_v2_external_calendar_worker_begin_result_v1",
  finalize: "hotels_v2_external_calendar_worker_finalize_v1",
  finalizeResult: "hotels_v2_external_calendar_worker_finalize_result_v1",
  fail: "hotels_v2_external_calendar_worker_fail_v1",
  failResult: "hotels_v2_external_calendar_worker_fail_result_v1",
  response: "hotels_v2_external_calendar_worker_response_v1",
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_CODE = /^[a-z0-9_]{1,120}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const TRIGGERS = new Set(["manual", "scheduled", "retry"]);

export class WorkerError extends Error {
  code: string;
  httpStatus: number | null;

  constructor(code: string, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = "WorkerError";
    this.code = SAFE_CODE.test(code) ? code : "worker_failure";
    this.httpStatus = Number.isInteger(httpStatus) && httpStatus! >= 100 && httpStatus! <= 599
      ? httpStatus
      : null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value === value.trim() && value.length > 0
    && value.length <= maximum && !CONTROL.test(value);
}

export type WorkerRequest = {
  contract_version: typeof CONTRACTS.request;
  enqueue_scheduled: boolean;
  limit: number;
};

export function parseWorkerRequest(value: unknown): WorkerRequest {
  if (!exactKeys(value, ["contract_version", "enqueue_scheduled", "limit"])
      || value.contract_version !== CONTRACTS.request
      || typeof value.enqueue_scheduled !== "boolean"
      || !Number.isInteger(value.limit) || Number(value.limit) < 1 || Number(value.limit) > LIMITS.sources) {
    throw new WorkerError("invalid_request", "The worker request envelope is invalid.");
  }
  return value as WorkerRequest;
}

export type SourceContract = {
  contract_version: typeof CONTRACTS.source;
  source_id: string;
  hotel_id: string;
  room_type_id: string;
  source_type: "booking_com" | "airbnb" | "ical";
  source_version: number;
  binding_version: number;
  is_enabled: boolean;
  review_status: string;
  hotel_external_sync_enabled: boolean;
  hotel_timezone: string;
  ical_url: string;
};

export function parseSourceContract(value: unknown): SourceContract {
  if (!exactKeys(value, [
    "contract_version", "source_id", "hotel_id", "room_type_id", "source_type",
    "source_version", "binding_version", "is_enabled", "review_status",
    "hotel_external_sync_enabled", "hotel_timezone", "ical_url",
  ]) || value.contract_version !== CONTRACTS.source
      || typeof value.source_id !== "string" || !UUID.test(value.source_id)
      || typeof value.hotel_id !== "string" || !UUID.test(value.hotel_id)
      || typeof value.room_type_id !== "string" || !UUID.test(value.room_type_id)
      || !["booking_com", "airbnb", "ical"].includes(String(value.source_type))
      || !Number.isInteger(value.source_version) || Number(value.source_version) < 1
      || !Number.isInteger(value.binding_version) || Number(value.binding_version) < 1
      || typeof value.is_enabled !== "boolean" || typeof value.hotel_external_sync_enabled !== "boolean"
      || !["requires_review", "reviewed"].includes(String(value.review_status))
      || !isSupportedTimeZone(value.hotel_timezone)
      || !boundedString(value.ical_url, LIMITS.urlCharacters)) {
    throw new WorkerError("invalid_source_contract", "The source RPC returned an invalid contract.");
  }
  return value as SourceContract;
}

export type LeaseJob = {
  job_id: string;
  source_id: string;
  hotel_id: string;
  room_type_id: string;
  source_version: number;
  binding_version: number;
  trigger_type: "manual" | "scheduled" | "retry";
  lease_token: string;
  leased_until: string;
};

export type SchedulerEnqueueResult = {
  contract_version: typeof CONTRACTS.schedulerEnqueue;
  global_enabled: boolean;
  queued_count: number;
};

export type SchedulerLeaseResult = {
  contract_version: typeof CONTRACTS.schedulerLease;
  global_enabled: boolean;
  jobs: LeaseJob[];
};

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const date = dateParts(`${match[1]}${match[2]}${match[3]}`);
  const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  if (!date || hour > 23 || minute > 59 || second > 59) return false;
  if (match[7] !== "Z") {
    const offsetHour = Number(match[7].slice(1, 3)); const offsetMinute = Number(match[7].slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

export function parseSchedulerEnqueueResult(value: unknown): SchedulerEnqueueResult {
  if (!exactKeys(value, ["contract_version", "global_enabled", "queued_count"])
      || value.contract_version !== CONTRACTS.schedulerEnqueue
      || typeof value.global_enabled !== "boolean"
      || !Number.isInteger(value.queued_count) || Number(value.queued_count) < 0 || Number(value.queued_count) > LIMITS.sources) {
    throw new WorkerError("invalid_scheduler_enqueue_contract", "The scheduler enqueue RPC returned an invalid contract.");
  }
  return value as SchedulerEnqueueResult;
}

export function parseSchedulerLeaseResult(value: unknown): SchedulerLeaseResult {
  if (!exactKeys(value, ["contract_version", "global_enabled", "jobs"])
      || value.contract_version !== CONTRACTS.schedulerLease
      || typeof value.global_enabled !== "boolean" || !Array.isArray(value.jobs)
      || value.jobs.length > LIMITS.sources) {
    throw new WorkerError("invalid_scheduler_lease_contract", "The scheduler lease RPC returned an invalid contract.");
  }
  const seenJobs = new Set<string>(); const seenSources = new Set<string>();
  const jobs = value.jobs.map((row) => {
    if (!exactKeys(row, [
      "job_id", "source_id", "hotel_id", "room_type_id", "source_version", "binding_version",
      "trigger_type", "lease_token", "leased_until",
    ]) || !isCanonicalUuid(row.job_id) || !isCanonicalUuid(row.source_id)
        || !isCanonicalUuid(row.hotel_id) || !isCanonicalUuid(row.room_type_id)
        || !isCanonicalUuid(row.lease_token) || !isCanonicalTimestamp(row.leased_until)
        || !Number.isInteger(row.source_version) || Number(row.source_version) < 1
        || !Number.isInteger(row.binding_version) || Number(row.binding_version) < 1
        || typeof row.trigger_type !== "string" || !TRIGGERS.has(row.trigger_type)
        || seenJobs.has(row.job_id) || seenSources.has(row.source_id)) {
      throw new WorkerError("invalid_scheduler_lease_contract", "The scheduler lease RPC returned an invalid job.");
    }
    seenJobs.add(row.job_id); seenSources.add(row.source_id);
    return row as LeaseJob;
  });
  if (!value.global_enabled && jobs.length) {
    throw new WorkerError("invalid_scheduler_lease_contract", "A disabled scheduler returned leased jobs.");
  }
  return { contract_version: CONTRACTS.schedulerLease, global_enabled: value.global_enabled, jobs };
}

type AttemptIdentity = { attempt_id: string; job_id: string; source_id: string };

function receiptIdentityIsValid(value: Record<string, unknown>, expected: AttemptIdentity): boolean {
  return value.attempt_id === expected.attempt_id && value.job_id === expected.job_id && value.source_id === expected.source_id;
}

export function parseBeginResult(value: unknown, expected: AttemptIdentity): Record<string, unknown> {
  if (!exactKeys(value, ["contract_version", "attempt_id", "job_id", "source_id", "status", "replayed"])
      || value.contract_version !== CONTRACTS.beginResult || value.status !== "running"
      || typeof value.replayed !== "boolean" || !receiptIdentityIsValid(value, expected)) {
    throw new WorkerError("invalid_begin_result_contract", "The begin RPC returned an invalid contract.");
  }
  return value;
}

export function parseFinalizeResult(value: unknown, expected: AttemptIdentity): Record<string, unknown> {
  if (!exactKeys(value, [
    "contract_version", "attempt_id", "job_id", "source_id", "status", "event_count",
    "active_event_count", "active_day_block_count", "replayed",
  ]) || value.contract_version !== CONTRACTS.finalizeResult || value.status !== "succeeded"
      || typeof value.replayed !== "boolean" || !receiptIdentityIsValid(value, expected)
      || !Number.isInteger(value.event_count) || Number(value.event_count) < 0
      || !Number.isInteger(value.active_event_count) || Number(value.active_event_count) < 0
      || Number(value.active_event_count) > Number(value.event_count)
      || !Number.isInteger(value.active_day_block_count) || Number(value.active_day_block_count) < 0
      || Number(value.active_day_block_count) > LIMITS.totalActiveDays) {
    throw new WorkerError("invalid_finalize_result_contract", "The finalize RPC returned an invalid contract.");
  }
  return value;
}

export function parseFailResult(value: unknown, expected: AttemptIdentity): Record<string, unknown> {
  if (!exactKeys(value, [
    "contract_version", "attempt_id", "job_id", "source_id", "status", "next_retry_at", "replayed",
  ]) || value.contract_version !== CONTRACTS.failResult || value.status !== "failed"
      || typeof value.replayed !== "boolean" || !receiptIdentityIsValid(value, expected)
      || !isCanonicalTimestamp(value.next_retry_at)) {
    throw new WorkerError("invalid_fail_result_contract", "The failure RPC returned an invalid contract.");
  }
  return value;
}

export type NormalizedEvent = {
  external_uid_hash: string;
  recurrence_id_hash: string | null;
  event_fingerprint: string;
  starts_on: string;
  ends_on: string;
  event_status: "active" | "cancelled";
  source_sequence: number | null;
  source_last_modified_at: string | null;
};

export type ParsedCalendar = {
  content_fingerprint: string;
  event_count: number;
  active_event_count: number;
  total_active_days: number;
  events: NormalizedEvent[];
};

type Property = { name: string; params: Record<string, string>; value: string };
type ParsedTemporal = { identity: string; startsOn: string; endsOn?: string; instant?: Date; isDate: boolean };

function isSupportedTimeZone(value: unknown): value is string {
  if (!boundedString(value, 100)) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  if (year < 1970 || year > 2199 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function isoDate(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addIsoDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function differenceDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}

function parseOffsetDateTime(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z|[+-]\d{4})$/.exec(value);
  if (!match) return null;
  const date = dateParts(`${match[1]}${match[2]}${match[3]}`);
  const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  if (!date || hour > 23 || minute > 59 || second > 59) return null;
  let offsetMinutes = 0;
  if (match[7] !== "Z") {
    const offsetHour = Number(match[7].slice(1, 3));
    const offsetMinute = Number(match[7].slice(3, 5));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (match[7][0] === "+" ? 1 : -1);
  }
  const milliseconds = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second) - offsetMinutes * 60_000;
  const parsed = new Date(milliseconds);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function zonedParts(instant: Date, timeZone: string): { date: string; hour: number; minute: number; second: number } {
  const values: Record<string, string> = {};
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function parseTemporal(property: Property, isEnd: boolean, hotelTimeZone: string): ParsedTemporal {
  const raw = property.value.trim();
  const declaredDate = property.params.VALUE?.toUpperCase() === "DATE";
  if (declaredDate || /^\d{8}$/.test(raw)) {
    const parts = dateParts(raw);
    if (!parts || (!declaredDate && property.params.VALUE && property.params.VALUE.toUpperCase() !== "DATE")) {
      throw new WorkerError("invalid_event_date", "An event contains an invalid calendar date.");
    }
    const date = isoDate(parts);
    return { identity: `DATE:${date}`, startsOn: date, endsOn: isEnd ? date : undefined, isDate: true };
  }
  const tzid = property.params.TZID;
  if (tzid && !/^(?:UTC|GMT|Etc\/UTC)$/i.test(tzid)) {
    throw new WorkerError("unsupported_event_timezone", "Only explicit UTC or offset date-times are supported.");
  }
  const instant = parseOffsetDateTime(raw.endsWith("Z") || /[+-]\d{4}$/.test(raw) ? raw : `${raw}Z`);
  if (!instant || (!raw.endsWith("Z") && !/[+-]\d{4}$/.test(raw) && !tzid)) {
    throw new WorkerError("invalid_event_datetime", "An event contains an invalid or floating date-time.");
  }
  const local = zonedParts(instant, hotelTimeZone);
  return { identity: `UTC:${instant.toISOString()}`, startsOn: local.date, endsOn: isEnd ? local.date : undefined, instant, isDate: false };
}

function findPropertySeparator(line: string): number {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (line[index] === ":" && !quoted) return index;
  }
  return -1;
}

function splitUnquoted(value: string, separator: string): string[] {
  const result: string[] = []; let quoted = false; let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') quoted = !quoted;
    if (value[index] === separator && !quoted) { result.push(value.slice(start, index)); start = index + 1; }
  }
  result.push(value.slice(start));
  return result;
}

function parseProperty(line: string): Property | null {
  const colon = findPropertySeparator(line);
  if (colon < 1) return null;
  const header = splitUnquoted(line.slice(0, colon), ";");
  const name = header.shift()!.toUpperCase();
  if (!/^[A-Z0-9-]{1,80}$/.test(name)) return null;
  const params: Record<string, string> = {};
  for (const rawParam of header) {
    const equals = rawParam.indexOf("=");
    if (equals < 1) continue;
    const key = rawParam.slice(0, equals).toUpperCase();
    let value = rawParam.slice(equals + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (/^[A-Z0-9-]{1,80}$/.test(key) && value.length <= 256) params[key] = value;
  }
  return { name, params, value: line.slice(colon + 1) };
}

function unfoldCalendar(text: string): string[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\0")) throw new WorkerError("invalid_calendar", "The calendar payload is invalid.");
  const physical = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
    if (lines.length > LIMITS.unfoldedLines
        || new TextEncoder().encode(lines[lines.length - 1] || "").length > LIMITS.unfoldedLineBytes) {
      throw new WorkerError("calendar_limit_exceeded", "The calendar exceeds the supported line limits.");
    }
  }
  return lines;
}

function exactSingle(properties: Property[], name: string, required: boolean): Property | null {
  const values = properties.filter((property) => property.name === name);
  if (values.length > 1 || (required && values.length !== 1)) {
    throw new WorkerError("invalid_event", `An event must contain exactly one ${name} value.`);
  }
  return values[0] || null;
}

async function normalizeEvent(properties: Property[], hotelTimeZone: string): Promise<NormalizedEvent> {
  const uid = exactSingle(properties, "UID", true)!;
  if (properties.some((property) => ["RRULE", "RDATE", "EXDATE"].includes(property.name))) {
    throw new WorkerError("unsupported_event_recurrence", "Recurring calendar rules must be expanded by the source before synchronization.");
  }
  const startProperty = exactSingle(properties, "DTSTART", true)!;
  const endProperty = exactSingle(properties, "DTEND", true)!;
  const recurrenceProperty = exactSingle(properties, "RECURRENCE-ID", false);
  const statusProperty = exactSingle(properties, "STATUS", false);
  const sequenceProperty = exactSingle(properties, "SEQUENCE", false);
  const modifiedProperty = exactSingle(properties, "LAST-MODIFIED", false);
  if (!boundedString(uid.value, 1_024)) throw new WorkerError("invalid_event_uid", "An event UID is invalid.");
  const start = parseTemporal(startProperty, false, hotelTimeZone);
  const end = parseTemporal(endProperty, true, hotelTimeZone);
  if (start.isDate !== end.isDate) throw new WorkerError("invalid_event_range", "An event start and end use incompatible value types.");
  if (!start.isDate && (!start.instant || !end.instant || end.instant.getTime() <= start.instant.getTime())) {
    throw new WorkerError("invalid_event_range", "An event end must be later than its start.");
  }
  const startsOn = start.startsOn;
  const endsOn = start.isDate
    ? end.endsOn!
    : end.startsOn > startsOn ? end.startsOn : addIsoDays(startsOn, 1);
  const span = differenceDays(startsOn, endsOn);
  if (span < 1 || span > LIMITS.daysPerEvent) throw new WorkerError("event_day_limit_exceeded", "An event exceeds the supported day span.");
  let sequence: number | null = null;
  if (sequenceProperty) {
    const value = sequenceProperty.value.trim();
    if (!/^\d{1,10}$/.test(value) || Number(value) > 2_147_483_647) throw new WorkerError("invalid_event_sequence", "An event sequence is invalid.");
    sequence = Number(value);
  }
  let modified: string | null = null;
  if (modifiedProperty) {
    const temporal = parseTemporal(modifiedProperty, false, "UTC");
    if (temporal.isDate || !temporal.instant) throw new WorkerError("invalid_event_last_modified", "An event LAST-MODIFIED value is invalid.");
    modified = temporal.instant.toISOString();
  }
  const statusValue = statusProperty?.value.trim().toUpperCase() || "CONFIRMED";
  if (!["CONFIRMED", "TENTATIVE", "CANCELLED"].includes(statusValue)) {
    throw new WorkerError("invalid_event_status", "An event status is invalid.");
  }
  const eventStatus = statusValue === "CANCELLED" ? "cancelled" : "active";
  const externalUidHash = await sha256(uid.value);
  let recurrenceIdHash: string | null = null;
  if (recurrenceProperty) recurrenceIdHash = await sha256(parseTemporal(recurrenceProperty, false, hotelTimeZone).identity);
  const base = {
    external_uid_hash: externalUidHash,
    recurrence_id_hash: recurrenceIdHash,
    starts_on: startsOn,
    ends_on: endsOn,
    event_status: eventStatus,
    source_sequence: sequence,
    source_last_modified_at: modified,
  };
  return { ...base, event_fingerprint: await sha256(canonicalJson(base)) };
}

function newerEvent(left: NormalizedEvent, right: NormalizedEvent): NormalizedEvent {
  const leftSequence = left.source_sequence ?? -1; const rightSequence = right.source_sequence ?? -1;
  if (leftSequence !== rightSequence) return leftSequence > rightSequence ? left : right;
  const leftModified = left.source_last_modified_at ? Date.parse(left.source_last_modified_at) : -1;
  const rightModified = right.source_last_modified_at ? Date.parse(right.source_last_modified_at) : -1;
  if (leftModified !== rightModified) return leftModified > rightModified ? left : right;
  return left.event_fingerprint >= right.event_fingerprint ? left : right;
}

export async function parseICalendar(text: string, hotelTimeZone = "UTC"): Promise<ParsedCalendar> {
  if (new TextEncoder().encode(text).length > LIMITS.responseBytes) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds 2 MB.");
  if (!isSupportedTimeZone(hotelTimeZone)) throw new WorkerError("invalid_hotel_timezone", "The Hotel timezone is invalid.");
  const lines = unfoldCalendar(text);
  if (lines[0]?.trim().toUpperCase() !== "BEGIN:VCALENDAR"
      || !lines.some((line) => line.trim().toUpperCase() === "END:VCALENDAR")) {
    throw new WorkerError("invalid_calendar", "The response is not a complete iCalendar document.");
  }
  const rawEvents: Property[][] = []; let current: Property[] | null = null;
  for (const line of lines) {
    const marker = line.trim().toUpperCase();
    if (marker === "BEGIN:VEVENT") {
      if (current) throw new WorkerError("invalid_calendar", "Nested calendar events are invalid.");
      current = [];
    } else if (marker === "END:VEVENT") {
      if (!current) throw new WorkerError("invalid_calendar", "An event terminator is unmatched.");
      rawEvents.push(current); current = null;
      if (rawEvents.length > LIMITS.events) throw new WorkerError("calendar_event_limit_exceeded", "The calendar contains more than 500 events.");
    } else if (current) {
      const property = parseProperty(line);
      if (property) current.push(property);
    }
  }
  if (current) throw new WorkerError("invalid_calendar", "An event is incomplete.");
  const deduplicated = new Map<string, NormalizedEvent>();
  for (const properties of rawEvents) {
    const event = await normalizeEvent(properties, hotelTimeZone);
    const key = `${event.external_uid_hash}:${event.recurrence_id_hash || ""}`;
    const prior = deduplicated.get(key);
    deduplicated.set(key, prior ? newerEvent(prior, event) : event);
  }
  const events = Array.from(deduplicated.values()).sort((left, right) => (
    left.external_uid_hash.localeCompare(right.external_uid_hash)
      || (left.recurrence_id_hash || "").localeCompare(right.recurrence_id_hash || "")
  ));
  const active = events.filter((event) => event.event_status === "active");
  const totalActiveDays = active.reduce((total, event) => total + differenceDays(event.starts_on, event.ends_on), 0);
  if (totalActiveDays > LIMITS.totalActiveDays) throw new WorkerError("calendar_day_limit_exceeded", "The calendar exceeds the supported active day-block limit.");
  return {
    content_fingerprint: await sha256(canonicalJson(events)),
    event_count: events.length,
    active_event_count: active.length,
    total_active_days: totalActiveDays,
    events,
  };
}

function parseIPv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.map(Number);
}

function ipv4IsPublic(value: string): boolean {
  const ip = parseIPv4(value);
  if (!ip) return false;
  const [a, b, c] = ip;
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && c <= 2)
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113));
}

function parseIPv6(value: string): number[] | null {
  let source = value.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (source.includes(".")) {
    const lastColon = source.lastIndexOf(":");
    const ipv4 = parseIPv4(source.slice(lastColon + 1));
    if (!ipv4) return null;
    source = `${source.slice(0, lastColon)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  const halves = source.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < (halves.length === 2 ? 1 : 0)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function ipv6IsPublic(value: string): boolean {
  const groups = parseIPv6(value);
  if (!groups) return false;
  const first = groups[0];
  if ((first & 0xe000) !== 0x2000) return false;
  if (first === 0x2001 && (groups[1] === 0x0000 || groups[1] === 0x0db8)) return false;
  if (first === 0x2002) return false;
  return true;
}

export function ipIsPublic(value: string): boolean {
  return value.includes(":") ? ipv6IsPublic(value) : ipv4IsPublic(value);
}

export type Resolver = (hostname: string, recordType: "A" | "AAAA") => Promise<string[]>;

export type PinnedHttpsTarget = {
  url: URL;
  hostname: string;
  address: string;
  port: 443;
};

export type PinnedConnection = {
  read(buffer: Uint8Array): Promise<number | null>;
  write(buffer: Uint8Array): Promise<number>;
  close(): void;
};

export type PinnedConnector = (target: PinnedHttpsTarget, deadline: number) => Promise<PinnedConnection>;

async function beforeDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new WorkerError("calendar_fetch_timeout", "The calendar request timed out.");
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new WorkerError("calendar_fetch_timeout", "The calendar request timed out.")), remaining);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function assertSafeHttpsUrl(
  raw: string,
  resolve: Resolver,
  deadline = Date.now() + LIMITS.timeoutMs,
): Promise<PinnedHttpsTarget> {
  if (!boundedString(raw, LIMITS.urlCharacters)) throw new WorkerError("unsafe_calendar_url", "The calendar URL is invalid.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new WorkerError("unsafe_calendar_url", "The calendar URL is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || url.hash) {
    throw new WorkerError("unsafe_calendar_url", "The calendar URL must use public HTTPS without credentials or fragments.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new WorkerError("unsafe_calendar_host", "The calendar host is not public.");
  }
  const literal = parseIPv4(hostname) || parseIPv6(hostname);
  if (literal) {
    if (!ipIsPublic(hostname)) throw new WorkerError("unsafe_calendar_host", "The calendar host is not public.");
    return { url, hostname, address: hostname, port: 443 };
  }
  const resolutions = await beforeDeadline(
    Promise.allSettled([resolve(hostname, "A"), resolve(hostname, "AAAA")]),
    deadline,
  );
  if (resolutions.every((result) => result.status === "rejected")) {
    throw new WorkerError("calendar_dns_failed", "The public calendar host could not be resolved.");
  }
  const addresses = resolutions.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!addresses.length || addresses.some((address) => !ipIsPublic(address))) {
    throw new WorkerError("unsafe_calendar_host", "The calendar host did not resolve only to public addresses.");
  }
  return { url, hostname, address: addresses[0], port: 443 };
}

type PinnedHttpResponse = { status: number; headers: Map<string, string[]>; body: Uint8Array };

function bytesIndexOf(value: Uint8Array, needle: number[], from = 0): number {
  outer: for (let index = from; index <= value.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (value[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function decodeAscii(value: Uint8Array, code = "invalid_calendar_http_response"): string {
  if (value.some((byte) => byte > 0x7f || byte === 0)) {
    throw new WorkerError(code, "The calendar provider returned an invalid HTTP response.");
  }
  return new TextDecoder("ascii").decode(value);
}

function parseHeaderLines(value: Uint8Array): { status: number; headers: Map<string, string[]> } {
  const text = decodeAscii(value);
  const lines = text.split("\r\n");
  const status = /^HTTP\/1\.[01] ([1-5][0-9]{2})(?: [\x20-\x7e]*)?$/.exec(lines.shift() || "");
  if (!status) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned an invalid HTTP response.");
  const headers = new Map<string, string[]>();
  for (const line of lines) {
    if (!line || /^[ \t]/.test(line)) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid HTTP headers.");
    const separator = line.indexOf(":");
    if (separator < 1) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid HTTP headers.");
    const name = line.slice(0, separator).toLowerCase();
    const headerValue = line.slice(separator + 1).trim();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name) || /[\u0000-\u001f\u007f]/u.test(headerValue)) {
      throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid HTTP headers.");
    }
    headers.set(name, [...(headers.get(name) || []), headerValue]);
  }
  return { status: Number(status[1]), headers };
}

function oneHeader(headers: Map<string, string[]>, name: string): string | null {
  const values = headers.get(name);
  if (!values?.length) return null;
  if (values.length !== 1) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned ambiguous HTTP headers.");
  return values[0];
}

function validateChunkTrailers(value: Uint8Array): void {
  if (value.length === 2 && value[0] === 13 && value[1] === 10) return;
  if (value.length < 4 || value.length > LIMITS.responseHeaderBytes
      || value[value.length - 4] !== 13 || value[value.length - 3] !== 10
      || value[value.length - 2] !== 13 || value[value.length - 1] !== 10) {
    throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk trailers.");
  }
  const text = decodeAscii(value.subarray(0, value.length - 4));
  for (const line of text.split("\r\n")) {
    const separator = line.indexOf(":");
    const name = separator > 0 ? line.slice(0, separator).toLowerCase() : "";
    const trailerValue = separator > 0 ? line.slice(separator + 1).trim() : "";
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)
        || /[\u0000-\u001f\u007f]/u.test(trailerValue)
        || ["content-length", "transfer-encoding", "content-encoding", "host"].includes(name)) {
      throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk trailers.");
    }
  }
}

function decodeChunkedBody(value: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  let total = 0;
  while (true) {
    const lineEnd = bytesIndexOf(value, [13, 10], position);
    if (lineEnd < 0 || lineEnd - position > 128) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk framing.");
    const line = decodeAscii(value.subarray(position, lineEnd));
    const sizeToken = line.split(";", 1)[0];
    if (!/^[0-9a-f]{1,16}$/i.test(sizeToken)) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk framing.");
    const size = Number.parseInt(sizeToken, 16);
    if (!Number.isSafeInteger(size)) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk framing.");
    position = lineEnd + 2;
    if (size === 0) {
      const trailer = value.subarray(position);
      validateChunkTrailers(trailer);
      break;
    }
    total += size;
    if (total > LIMITS.responseBytes) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds 2 MB.");
    if (position + size + 2 > value.length || value[position + size] !== 13 || value[position + size + 1] !== 10) {
      throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned truncated chunk data.");
    }
    chunks.push(value.slice(position, position + size));
    position += size + 2;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function chunkedWireLengthIfComplete(value: Uint8Array): number | null {
  let position = 0;
  while (true) {
    const lineEnd = bytesIndexOf(value, [13, 10], position);
    if (lineEnd < 0) {
      if (value.length - position > 128) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk framing.");
      return null;
    }
    if (lineEnd - position > 128) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk framing.");
    const sizeToken = decodeAscii(value.subarray(position, lineEnd)).split(";", 1)[0];
    if (!/^[0-9a-f]{1,16}$/i.test(sizeToken)) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk framing.");
    const size = Number.parseInt(sizeToken, 16);
    if (!Number.isSafeInteger(size) || size > LIMITS.responseBytes) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds 2 MB.");
    position = lineEnd + 2;
    if (size === 0) {
      if (value.length < position + 2) return null;
      if (value[position] === 13 && value[position + 1] === 10) return position + 2;
      const trailerEnd = bytesIndexOf(value, [13, 10, 13, 10], position);
      if (trailerEnd < 0) {
        if (value.length - position > LIMITS.responseHeaderBytes) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk trailers.");
        return null;
      }
      const end = trailerEnd + 4;
      validateChunkTrailers(value.subarray(position, end));
      return end;
    }
    if (position + size + 2 > value.length) return null;
    if (value[position + size] !== 13 || value[position + size + 1] !== 10) {
      throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned invalid chunk framing.");
    }
    position += size + 2;
  }
}

function responseWireLengthIfComplete(value: Uint8Array): number | null {
  const headerEnd = bytesIndexOf(value, [13, 10, 13, 10]);
  if (headerEnd < 0) {
    if (value.length > LIMITS.responseHeaderBytes) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned oversized HTTP headers.");
    return null;
  }
  if (headerEnd > LIMITS.responseHeaderBytes) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned oversized HTTP headers.");
  const { headers } = parseHeaderLines(value.subarray(0, headerEnd));
  const transferEncoding = oneHeader(headers, "transfer-encoding")?.toLowerCase() || null;
  const contentLength = oneHeader(headers, "content-length");
  const contentEncoding = oneHeader(headers, "content-encoding")?.toLowerCase() || "identity";
  if (contentEncoding !== "identity" || (transferEncoding && contentLength !== null)
      || (transferEncoding && transferEncoding !== "chunked")) {
    throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned unsupported HTTP framing.");
  }
  const bodyStart = headerEnd + 4;
  if (transferEncoding === "chunked") {
    const length = chunkedWireLengthIfComplete(value.subarray(bodyStart));
    return length === null ? null : bodyStart + length;
  }
  if (contentLength !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(contentLength)) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned an invalid Content-Length.");
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length > LIMITS.responseBytes) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds 2 MB.");
    return value.length >= bodyStart + length ? bodyStart + length : null;
  }
  if (value.length - bodyStart > LIMITS.responseBytes) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds 2 MB.");
  return null;
}

function parsePinnedHttpResponse(value: Uint8Array): PinnedHttpResponse {
  const headerEnd = bytesIndexOf(value, [13, 10, 13, 10]);
  if (headerEnd < 0 || headerEnd > LIMITS.responseHeaderBytes) {
    throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned oversized or incomplete HTTP headers.");
  }
  const { status, headers } = parseHeaderLines(value.subarray(0, headerEnd));
  const wireBody = value.subarray(headerEnd + 4);
  const transferEncoding = oneHeader(headers, "transfer-encoding")?.toLowerCase() || null;
  const contentLength = oneHeader(headers, "content-length");
  const contentEncoding = oneHeader(headers, "content-encoding")?.toLowerCase() || "identity";
  if (contentEncoding !== "identity" || (transferEncoding && contentLength !== null)
      || (transferEncoding && transferEncoding !== "chunked")) {
    throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned unsupported HTTP framing.", status);
  }
  let body: Uint8Array;
  if (transferEncoding === "chunked") {
    body = decodeChunkedBody(wireBody);
  } else if (contentLength !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(contentLength)) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned an invalid Content-Length.", status);
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length > LIMITS.responseBytes) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds 2 MB.", status);
    if (wireBody.length !== length) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned a truncated or ambiguous body.", status);
    body = wireBody.slice();
  } else {
    if (wireBody.length > LIMITS.responseBytes) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds 2 MB.", status);
    body = wireBody.slice();
  }
  return { status, headers, body };
}

async function connectBeforeDeadline(connect: PinnedConnector, target: PinnedHttpsTarget, deadline: number): Promise<PinnedConnection> {
  const pending = connect(target, deadline);
  try {
    return await beforeDeadline(pending, deadline);
  } catch (error) {
    void pending.then((connection) => connection.close()).catch(() => undefined);
    throw error;
  }
}

async function writeAll(connection: PinnedConnection, value: Uint8Array, deadline: number): Promise<void> {
  let offset = 0;
  while (offset < value.length) {
    const written = await beforeDeadline(connection.write(value.subarray(offset)), deadline);
    if (!Number.isInteger(written) || written <= 0 || written > value.length - offset) {
      throw new WorkerError("calendar_fetch_failed", "The calendar provider connection failed.");
    }
    offset += written;
  }
}

async function requestPinned(target: PinnedHttpsTarget, connect: PinnedConnector, deadline: number): Promise<PinnedHttpResponse> {
  let connection: PinnedConnection | null = null;
  try {
    connection = await connectBeforeDeadline(connect, target, deadline);
    const requestTarget = `${target.url.pathname || "/"}${target.url.search}`;
    if (/[\r\n]/.test(requestTarget)) throw new WorkerError("unsafe_calendar_url", "The calendar URL is invalid.");
    const request = new TextEncoder().encode([
      `GET ${requestTarget} HTTP/1.1`,
      `Host: ${target.url.host}`,
      "Accept: text/calendar, text/plain;q=0.8",
      "Accept-Encoding: identity",
      "Connection: close",
      "User-Agent: CyprusEye-Hotels-V2-Calendar/1",
      "",
      "",
    ].join("\r\n"));
    await writeAll(connection, request, deadline);
    const chunks: Uint8Array[] = [];
    let total = 0;
    let headerComplete = false;
    const wireLimit = LIMITS.responseBytes + LIMITS.responseHeaderBytes + LIMITS.responseWireOverheadBytes;
    while (true) {
      const buffer = new Uint8Array(16 * 1024);
      const read = await beforeDeadline(connection.read(buffer), deadline);
      if (read === null) break;
      if (!Number.isInteger(read) || read <= 0 || read > buffer.length) throw new WorkerError("calendar_fetch_failed", "The calendar provider connection failed.");
      const chunk = buffer.slice(0, read);
      chunks.push(chunk); total += read;
      if (total > wireLimit) throw new WorkerError("calendar_payload_too_large", "The calendar payload exceeds its transport bound.");
      if (!headerComplete) {
        const joined = new Uint8Array(total); let offset = 0;
        for (const item of chunks) { joined.set(item, offset); offset += item.length; }
        const headerEnd = bytesIndexOf(joined, [13, 10, 13, 10]);
        headerComplete = headerEnd >= 0;
        if (!headerComplete && total > LIMITS.responseHeaderBytes) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned oversized HTTP headers.");
      }
      if (headerComplete) {
        const joined = new Uint8Array(total); let offset = 0;
        for (const item of chunks) { joined.set(item, offset); offset += item.length; }
        const completeLength = responseWireLengthIfComplete(joined);
        if (completeLength !== null) {
          if (completeLength !== joined.length) throw new WorkerError("invalid_calendar_http_response", "The calendar provider returned an ambiguous HTTP response.");
          break;
        }
      }
    }
    const value = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { value.set(chunk, offset); offset += chunk.length; }
    return parsePinnedHttpResponse(value);
  } finally {
    try { connection?.close(); } catch { /* The pinned socket is always best-effort closed. */ }
  }
}

function decodeCalendarBody(body: Uint8Array, status: number): string {
  if (!body.length) throw new WorkerError("empty_calendar_response", "The calendar response is empty.", status);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(body); }
  catch { throw new WorkerError("invalid_calendar_encoding", "The calendar payload is not valid UTF-8.", status); }
}

export async function fetchCalendar(
  rawUrl: string,
  options: { connect: PinnedConnector; resolve: Resolver; timeoutMs?: number },
): Promise<{ text: string; httpStatus: number }> {
  const deadline = Date.now() + Math.min(Math.max(options.timeoutMs ?? LIMITS.timeoutMs, 1_000), 15_000);
  let target = await assertSafeHttpsUrl(rawUrl, options.resolve, deadline);
  for (let redirects = 0; redirects <= LIMITS.redirects; redirects += 1) {
    try {
      const response = await requestPinned(target, options.connect, deadline);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = oneHeader(response.headers, "location");
        if (!location || redirects === LIMITS.redirects) throw new WorkerError("calendar_redirect_rejected", "The calendar redirect chain is invalid.", response.status);
        target = await assertSafeHttpsUrl(new URL(location, target.url).toString(), options.resolve, deadline);
        continue;
      }
      if (response.status !== 200) {
        throw new WorkerError("calendar_http_failure", "The calendar provider returned a non-success status.", response.status);
      }
      const contentType = (oneHeader(response.headers, "content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (contentType && !["text/calendar", "text/plain", "application/octet-stream"].includes(contentType)) {
        throw new WorkerError("calendar_content_type_rejected", "The calendar response content type is unsupported.", response.status);
      }
      return { text: decodeCalendarBody(response.body, response.status), httpStatus: response.status };
    } catch (error) {
      if (error instanceof WorkerError) throw error;
      throw new WorkerError("calendar_fetch_failed", "The calendar provider could not be reached.");
    }
  }
  throw new WorkerError("calendar_redirect_rejected", "The calendar redirect chain is invalid.");
}

export function sanitizeFailure(error: unknown): { error_code: string; error_message: string; http_status: number | null } {
  if (error instanceof WorkerError) return { error_code: error.code, error_message: error.message.slice(0, 500), http_status: error.httpStatus };
  return { error_code: "worker_failure", error_message: "The calendar source failed without exposing provider details.", http_status: null };
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256.test(value);
}
