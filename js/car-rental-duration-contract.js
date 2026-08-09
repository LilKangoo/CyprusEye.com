export const RENTAL_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
export const CAR_RENTAL_TIME_ZONE = 'Europe/Nicosia';
const EXPLICIT_OFFSET = /(z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function instantMilliseconds(value, fieldName = 'instant') {
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    if (Number.isFinite(milliseconds)) return milliseconds;
    throw new TypeError(`${fieldName} must be a valid instant`);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && EXPLICIT_OFFSET.test(value.trim())) {
    const milliseconds = Date.parse(value);
    if (Number.isFinite(milliseconds)) return milliseconds;
  }
  throw new TypeError(`${fieldName} must include UTC or an explicit timezone offset`);
}

export function calculateRentalDaysFromInstants(pickupInstant, returnInstant) {
  const pickupMilliseconds = instantMilliseconds(pickupInstant, 'pickupInstant');
  const returnMilliseconds = instantMilliseconds(returnInstant, 'returnInstant');
  const elapsedMilliseconds = returnMilliseconds - pickupMilliseconds;
  if (!(elapsedMilliseconds > 0)) return null;
  return Math.ceil(elapsedMilliseconds / RENTAL_DAY_MILLISECONDS);
}

function localParts(dateValue, timeValue) {
  const dateMatch = String(dateValue || '').trim().match(LOCAL_DATE);
  const timeMatch = String(timeValue || '10:00').trim().match(LOCAL_TIME);
  if (!dateMatch || !timeMatch) throw new TypeError('Local rental date/time is invalid');
  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] || 0),
  };
}

function formattedParts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out = {};
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return out;
}

function sameLocalParts(left, right) {
  return ['year', 'month', 'day', 'hour', 'minute', 'second']
    .every((key) => Number(left[key]) === Number(right[key]));
}

/**
 * Converts a wall-clock value selected in Cyprus to one deterministic instant.
 * PostgreSQL's `timestamp AT TIME ZONE 'Europe/Nicosia'` also chooses the
 * standard-time occurrence when a clock value is repeated. Non-existent local
 * times fail closed instead of being shifted silently.
 */
export function zonedLocalDateTimeToInstant(
  dateValue,
  timeValue = '10:00',
  timeZone = CAR_RENTAL_TIME_ZONE,
) {
  if (typeof Intl !== 'object' || typeof Intl.DateTimeFormat !== 'function') {
    throw new Error('Timezone-aware rental duration is unavailable');
  }
  const desired = localParts(dateValue, timeValue);
  const naiveUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );
  let instant = naiveUtc;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const observed = formattedParts(instant, timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const next = naiveUtc - (observedAsUtc - instant);
    if (next === instant) break;
    instant = next;
  }
  if (!sameLocalParts(formattedParts(instant, timeZone), desired)) {
    throw new RangeError('Local rental date/time does not exist in Europe/Nicosia');
  }
  return new Date(instant).toISOString();
}

export function buildRentalInstantsFromLocalDateTimes({
  pickupDate,
  pickupTime = '10:00',
  returnDate,
  returnTime = '10:00',
  timeZone = CAR_RENTAL_TIME_ZONE,
} = {}) {
  const pickupInstant = zonedLocalDateTimeToInstant(pickupDate, pickupTime, timeZone);
  const returnInstant = zonedLocalDateTimeToInstant(returnDate, returnTime, timeZone);
  return Object.freeze({ pickupInstant, returnInstant, timeZone });
}

export function calculateRentalDaysFromLocalDateTimes(input = {}) {
  const instants = buildRentalInstantsFromLocalDateTimes(input);
  return calculateRentalDaysFromInstants(instants.pickupInstant, instants.returnInstant);
}

function registerGlobal(root) {
  const api = Object.freeze({
    RENTAL_DAY_MILLISECONDS,
    CAR_RENTAL_TIME_ZONE,
    calculateRentalDaysFromInstants,
    calculateRentalDaysFromLocalDateTimes,
    buildRentalInstantsFromLocalDateTimes,
    zonedLocalDateTimeToInstant,
    instantMilliseconds,
  });

  Object.defineProperty(root, 'CarRentalDurationContract', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
}

registerGlobal(typeof window !== 'undefined' ? window : globalThis);
