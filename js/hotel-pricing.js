(function attachHotelPricing(globalScope) {
  'use strict';

  const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function normalizeNumber(value) {
    if (value === '' || value == null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function clampPositiveInt(value, fallback) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return Math.round(num);
    return fallback;
  }

  function parseIsoDate(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  }

  function formatIsoDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addUtcDays(date, days) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + Number(days || 0));
    return next;
  }

  function buildStayDates(arrivalDate, nights) {
    const totalNights = clampPositiveInt(nights, 1);
    const start = parseIsoDate(arrivalDate);
    if (!start) return [];
    const dates = [];
    for (let index = 0; index < totalNights; index += 1) {
      dates.push(addUtcDays(start, index));
    }
    return dates;
  }

  function normalizeWeekdayKey(key) {
    const raw = String(key || '').trim().toLowerCase();
    if (!raw) return '';
    if (WEEKDAY_KEYS.includes(raw)) return raw;
    if (/^\d+$/.test(raw)) {
      const idx = Number(raw);
      if (idx >= 0 && idx <= 6) return WEEKDAY_KEYS[idx];
    }
    const aliases = {
      monday: 'mon',
      tuesday: 'tue',
      wednesday: 'wed',
      thursday: 'thu',
      friday: 'fri',
      saturday: 'sat',
      sunday: 'sun',
      pon: 'mon',
      wt: 'tue',
      śr: 'wed',
      sr: 'wed',
      czw: 'thu',
      pt: 'fri',
      sob: 'sat',
      niedz: 'sun',
      niedziela: 'sun',
    };
    return aliases[raw] || '';
  }

  function normalizeMonthKey(key) {
    const raw = String(key || '').trim().toLowerCase();
    if (!raw) return '';
    if (MONTH_KEYS.includes(raw)) return raw;
    if (/^\d+$/.test(raw)) {
      const idx = Number(raw);
      if (idx >= 1 && idx <= 12) return MONTH_KEYS[idx - 1];
    }
    const aliases = {
      january: 'jan',
      february: 'feb',
      march: 'mar',
      april: 'apr',
      june: 'jun',
      july: 'jul',
      august: 'aug',
      september: 'sep',
      october: 'oct',
      november: 'nov',
      december: 'dec',
      styczen: 'jan',
      luty: 'feb',
      marzec: 'mar',
      kwiecien: 'apr',
      maj: 'may',
      czerwiec: 'jun',
      lipiec: 'jul',
      sierpien: 'aug',
      wrzesien: 'sep',
      pazdziernik: 'oct',
      listopad: 'nov',
      grudzien: 'dec',
    };
    return aliases[raw] || '';
  }

  function normalizeOverrideMap(map, normalizer) {
    const out = {};
    if (!map || typeof map !== 'object') return out;
    Object.entries(map).forEach(([rawKey, rawValue]) => {
      const key = normalizer(rawKey);
      const value = normalizeNumber(rawValue);
      if (key && value != null && value >= 0) {
        out[key] = Number(value);
      }
    });
    return out;
  }

  function getRuleWeekdayOverrides(rule) {
    return normalizeOverrideMap(rule && rule.weekday_prices, normalizeWeekdayKey);
  }

  function getRuleMonthOverrides(rule) {
    return normalizeOverrideMap(rule && rule.month_prices, normalizeMonthKey);
  }

  function ruleHasWeekdayOverrides(rule) {
    return Object.keys(getRuleWeekdayOverrides(rule)).length > 0;
  }

  function ruleHasMonthOverrides(rule) {
    return Object.keys(getRuleMonthOverrides(rule)).length > 0;
  }

  function getNightlyRateForDate(rule, date) {
    const baseRate = Math.max(0, Number(rule && rule.price_per_night) || 0);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return { rate: baseRate, source: 'base', weekdayKey: '', monthKey: '' };
    }

    const weekdayKey = WEEKDAY_KEYS[date.getUTCDay()] || '';
    const monthKey = MONTH_KEYS[date.getUTCMonth()] || '';
    const monthOverrides = getRuleMonthOverrides(rule);
    const weekdayOverrides = getRuleWeekdayOverrides(rule);

    let rate = baseRate;
    let source = 'base';

    if (monthKey && Object.prototype.hasOwnProperty.call(monthOverrides, monthKey)) {
      rate = monthOverrides[monthKey];
      source = 'month';
    }
    if (weekdayKey && Object.prototype.hasOwnProperty.call(weekdayOverrides, weekdayKey)) {
      rate = weekdayOverrides[weekdayKey];
      source = source === 'month' ? 'month+weekday' : 'weekday';
    }

    return { rate, source, weekdayKey, monthKey };
  }

  function getRuleMinNightlyRate(rule) {
    const baseRate = Math.max(0, Number(rule && rule.price_per_night) || 0);
    let minRate = baseRate;
    for (let monthIndex = 0; monthIndex < MONTH_KEYS.length; monthIndex += 1) {
      for (let weekdayIndex = 0; weekdayIndex < WEEKDAY_KEYS.length; weekdayIndex += 1) {
        const probe = new Date(Date.UTC(2026, monthIndex, 1 + weekdayIndex, 12, 0, 0, 0));
        const candidate = getNightlyRateForDate(rule, probe).rate;
        if (Number.isFinite(candidate) && candidate < minRate) {
          minRate = candidate;
        }
      }
    }
    return Number.isFinite(minRate) ? Number(minRate) : null;
  }

  function getRuleMaxNightlyRate(rule) {
    const baseRate = Math.max(0, Number(rule && rule.price_per_night) || 0);
    let maxRate = baseRate;
    for (let monthIndex = 0; monthIndex < MONTH_KEYS.length; monthIndex += 1) {
      for (let weekdayIndex = 0; weekdayIndex < WEEKDAY_KEYS.length; weekdayIndex += 1) {
        const probe = new Date(Date.UTC(2026, monthIndex, 1 + weekdayIndex, 12, 0, 0, 0));
        const candidate = getNightlyRateForDate(rule, probe).rate;
        if (Number.isFinite(candidate) && candidate > maxRate) {
          maxRate = candidate;
        }
      }
    }
    return Number.isFinite(maxRate) ? Number(maxRate) : null;
  }

  function cloneRules(rules) {
    return Array.isArray(rules) ? rules.slice() : [];
  }

  function findTierByPersons(rules, persons) {
    const tiers = cloneRules(rules);
    let rule = tiers.find((entry) => Number(entry && entry.persons) === persons);
    if (rule) return rule;
    const lowers = tiers.filter((entry) => Number(entry && entry.persons) <= persons);
    if (lowers.length) {
      return lowers.sort((a, b) => Number(b.persons) - Number(a.persons))[0];
    }
    return null;
  }

  function findBestTierByNights(rules, nights) {
    const tiers = cloneRules(rules);
    const matching = tiers
      .filter((entry) => !entry?.min_nights || Number(entry.min_nights) <= nights)
      .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
    return matching[0] || tiers[0] || null;
  }

  function findBestTierByPersonsAndNights(rules, persons, nights) {
    const tiers = cloneRules(rules);
    let personTiers = tiers.filter((entry) => Number(entry && entry.persons) === persons);
    if (!personTiers.length) {
      const lowers = tiers.filter((entry) => Number(entry && entry.persons) <= persons);
      if (lowers.length) {
        const maxPersons = Math.max.apply(null, lowers.map((entry) => Number(entry.persons)));
        personTiers = lowers.filter((entry) => Number(entry.persons) === maxPersons);
      }
    }
    if (!personTiers.length) return null;
    const matching = personTiers
      .filter((entry) => !entry?.min_nights || Number(entry.min_nights) <= nights)
      .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
    return matching[0] || personTiers[0] || null;
  }

  function pickRuleForBooking(hotel, persons, nights) {
    const model = String(hotel && hotel.pricing_model || 'per_person_per_night');
    const tiers = hotel && hotel.pricing_tiers && Array.isArray(hotel.pricing_tiers.rules)
      ? hotel.pricing_tiers.rules
      : [];
    if (!tiers.length) return null;

    switch (model) {
      case 'flat_per_night':
        return findBestTierByNights(tiers, nights);
      case 'tiered_by_nights':
        return findBestTierByPersonsAndNights(tiers, persons, nights);
      case 'per_person_per_night':
      case 'category_per_night':
      default:
        return findTierByPersons(tiers, persons);
    }
  }

  function getFallbackRule(hotel) {
    const tiers = hotel && hotel.pricing_tiers && Array.isArray(hotel.pricing_tiers.rules)
      ? hotel.pricing_tiers.rules.slice()
      : [];
    return tiers.sort((a, b) => Number(a && a.price_per_night) - Number(b && b.price_per_night))[0] || null;
  }

  function calculateHotelPrice(hotel, persons, nights, options) {
    const safePersons = clampPositiveInt(persons, 1);
    const safeNights = clampPositiveInt(nights, 1);
    const opts = options && typeof options === 'object' ? options : {};
    const arrivalDate = String(opts.arrivalDate || '').trim();

    const tier = pickRuleForBooking(hotel, safePersons, safeNights) || getFallbackRule(hotel);
    if (!tier) {
      return {
        total: 0,
        actualTotal: 0,
        averageNightlyPrice: 0,
        minimumNightlyPrice: 0,
        maximumNightlyPrice: 0,
        pricePerNight: 0,
        billableNights: safeNights,
        extraBillableNights: 0,
        nightlyRates: [],
        hasVariableNightlyRates: false,
        usesWeekdayPricing: false,
        usesMonthPricing: false,
        tier: null,
      };
    }

    const stayDates = buildStayDates(arrivalDate, safeNights);
    let nightlyRates = stayDates.map((date) => {
      const info = getNightlyRateForDate(tier, date);
      return {
        date: formatIsoDate(date),
        rate: Number(info.rate || 0),
        source: info.source,
        weekdayKey: info.weekdayKey,
        monthKey: info.monthKey,
      };
    });

    if (!nightlyRates.length) {
      const fallbackRate = Math.max(0, Number(tier.price_per_night) || 0);
      nightlyRates = Array.from({ length: safeNights }, (_, index) => ({
        date: '',
        rate: fallbackRate,
        source: 'base',
        weekdayKey: '',
        monthKey: '',
        sequence: index + 1,
      }));
    }

    const actualTotal = nightlyRates.reduce((sum, entry) => sum + (Number(entry.rate) || 0), 0);
    const averageNightlyPrice = nightlyRates.length ? actualTotal / nightlyRates.length : Math.max(0, Number(tier.price_per_night) || 0);
    const minimumNightlyPrice = nightlyRates.reduce((min, entry) => Math.min(min, Number(entry.rate) || 0), Number.POSITIVE_INFINITY);
    const maximumNightlyPrice = nightlyRates.reduce((max, entry) => Math.max(max, Number(entry.rate) || 0), 0);
    const minNights = clampPositiveInt(tier.min_nights, 0);
    const billableNights = minNights ? Math.max(minNights, safeNights) : safeNights;
    const extraBillableNights = Math.max(0, billableNights - safeNights);
    const total = actualTotal + extraBillableNights * averageNightlyPrice;

    return {
      total: Number(total.toFixed(2)),
      actualTotal: Number(actualTotal.toFixed(2)),
      averageNightlyPrice: Number(averageNightlyPrice.toFixed(2)),
      minimumNightlyPrice: Number((Number.isFinite(minimumNightlyPrice) ? minimumNightlyPrice : 0).toFixed(2)),
      maximumNightlyPrice: Number(maximumNightlyPrice.toFixed(2)),
      pricePerNight: Number(averageNightlyPrice.toFixed(2)),
      billableNights,
      extraBillableNights,
      nightlyRates,
      hasVariableNightlyRates: nightlyRates.some((entry) => Number(entry.rate) !== Number(nightlyRates[0] && nightlyRates[0].rate)),
      usesWeekdayPricing: ruleHasWeekdayOverrides(tier),
      usesMonthPricing: ruleHasMonthOverrides(tier),
      tier,
    };
  }

  function getHotelMinPricePerNight(hotel, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const rules = hotel && hotel.pricing_tiers && Array.isArray(hotel.pricing_tiers.rules)
      ? hotel.pricing_tiers.rules
      : [];
    if (!rules.length) return null;

    const preferredPersons = normalizeNumber(opts.preferredPersons);
    const candidateRules = preferredPersons != null
      ? rules.filter((rule) => Number(rule && rule.persons) === preferredPersons)
      : [];
    const relevant = candidateRules.length ? candidateRules : rules;

    let minRate = Number.POSITIVE_INFINITY;
    relevant.forEach((rule) => {
      const rate = getRuleMinNightlyRate(rule);
      if (rate != null && rate < minRate) {
        minRate = rate;
      }
    });
    return Number.isFinite(minRate) ? Number(minRate.toFixed(2)) : null;
  }

  function getHotelMaxPricePerNight(hotel, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const rules = hotel && hotel.pricing_tiers && Array.isArray(hotel.pricing_tiers.rules)
      ? hotel.pricing_tiers.rules
      : [];
    if (!rules.length) return null;

    const preferredPersons = normalizeNumber(opts.preferredPersons);
    const candidateRules = preferredPersons != null
      ? rules.filter((rule) => Number(rule && rule.persons) === preferredPersons)
      : [];
    const relevant = candidateRules.length ? candidateRules : rules;

    let maxRate = 0;
    relevant.forEach((rule) => {
      const rate = getRuleMaxNightlyRate(rule);
      if (rate != null && rate > maxRate) {
        maxRate = rate;
      }
    });
    return Number.isFinite(maxRate) ? Number(maxRate.toFixed(2)) : null;
  }

  function buildPricingPreviewLabel(hotel, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const min = getHotelMinPricePerNight(hotel, opts);
    if (min == null) return '';
    const prefix = String(opts.prefix || '').trim();
    const suffix = String(opts.suffix || '').trim();
    return `${prefix ? `${prefix} ` : ''}${min.toFixed(2)} €${suffix ? ` ${suffix}` : ''}`.trim();
  }

  globalScope.CE_HOTEL_PRICING = {
    WEEKDAY_KEYS: WEEKDAY_KEYS.slice(),
    WEEKDAY_LABELS: WEEKDAY_LABELS.slice(),
    MONTH_KEYS: MONTH_KEYS.slice(),
    MONTH_LABELS: MONTH_LABELS.slice(),
    parseIsoDate,
    formatIsoDate,
    buildStayDates,
    calculateHotelPrice,
    getHotelMinPricePerNight,
    getHotelMaxPricePerNight,
    buildPricingPreviewLabel,
    getRuleWeekdayOverrides,
    getRuleMonthOverrides,
    getNightlyRateForDate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
