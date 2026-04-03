(function attachHotelPricing(globalScope) {
  'use strict';

  const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const HOTEL_EXTRA_CHARGE_TYPES = ['per_stay', 'per_night', 'per_person_per_stay', 'per_person_per_night'];
  const HOTEL_PRICING_MODELS = ['per_person_per_night', 'category_per_night', 'tiered_by_nights', 'flat_per_night'];
  const HOTEL_RATE_PLAN_ADJUSTMENT_TYPES = ['none', 'fixed_per_night', 'percent'];
  const HOTEL_RATE_PLAN_CANCELLATION_TYPES = ['standard', 'non_refundable_before_deposit'];

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

  function clampNonNegativeInt(value, fallback) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) return Math.round(num);
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

  function roundMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(2));
  }

  function normalizeIdentifier(value, fallback) {
    const raw = String(value || '').trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return raw || String(fallback || '').trim() || '';
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

  function normalizeExactDateKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) return '';
    return parseIsoDate(match[1]) ? match[1] : '';
  }

  function normalizeDateOverrideMap(value) {
    const out = {};
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const key = normalizeExactDateKey(entry.date || entry.iso || entry.day || entry.key);
        const amount = normalizeNumber(entry.price_per_night ?? entry.price ?? entry.amount);
        if (!key || amount == null || amount < 0) return;
        out[key] = Number(amount);
      });
      return out;
    }
    if (!value || typeof value !== 'object') return out;
    Object.entries(value).forEach(([rawKey, rawValue]) => {
      const key = normalizeExactDateKey(rawKey);
      const amount = normalizeNumber(rawValue);
      if (!key || amount == null || amount < 0) return;
      out[key] = Number(amount);
    });
    return out;
  }

  function getRuleWeekdayOverrides(rule) {
    return normalizeOverrideMap(rule && rule.weekday_prices, normalizeWeekdayKey);
  }

  function getRuleMonthOverrides(rule) {
    return normalizeOverrideMap(rule && rule.month_prices, normalizeMonthKey);
  }

  function getRuleDateOverrides(rule) {
    return normalizeDateOverrideMap(rule && (rule.date_prices || rule.date_overrides || rule.exact_date_prices));
  }

  function ruleHasWeekdayOverrides(rule) {
    return Object.keys(getRuleWeekdayOverrides(rule)).length > 0;
  }

  function ruleHasMonthOverrides(rule) {
    return Object.keys(getRuleMonthOverrides(rule)).length > 0;
  }

  function ruleHasDateOverrides(rule) {
    return Object.keys(getRuleDateOverrides(rule)).length > 0;
  }

  function getNightlyRateForDate(rule, date) {
    const baseRate = Math.max(0, Number(rule && rule.price_per_night) || 0);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return { rate: baseRate, source: 'base', weekdayKey: '', monthKey: '' };
    }

    const isoDate = formatIsoDate(date);
    const weekdayKey = WEEKDAY_KEYS[date.getUTCDay()] || '';
    const monthKey = MONTH_KEYS[date.getUTCMonth()] || '';
    const dateOverrides = getRuleDateOverrides(rule);
    const monthOverrides = getRuleMonthOverrides(rule);
    const weekdayOverrides = getRuleWeekdayOverrides(rule);

    if (isoDate && Object.prototype.hasOwnProperty.call(dateOverrides, isoDate)) {
      return { rate: dateOverrides[isoDate], source: 'date', weekdayKey, monthKey, dateKey: isoDate };
    }

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

    return { rate, source, weekdayKey, monthKey, dateKey: isoDate };
  }

  function getRuleMinNightlyRate(rule) {
    const baseRate = Math.max(0, Number(rule && rule.price_per_night) || 0);
    let minRate = baseRate;
    Object.values(getRuleDateOverrides(rule)).forEach((value) => {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount < minRate) {
        minRate = amount;
      }
    });
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
    Object.values(getRuleDateOverrides(rule)).forEach((value) => {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount > maxRate) {
        maxRate = amount;
      }
    });
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

  function normalizeLocalizedTextMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      if (typeof value === 'string' && value.trim()) {
        const text = value.trim();
        return { en: text, pl: text };
      }
      return {};
    }
    const out = {};
    ['pl', 'en', 'el', 'he'].forEach((lang) => {
      const text = String(value[lang] || '').trim();
      if (text) out[lang] = text;
    });
    return out;
  }

  function getLocalizedTextMapValue(value, language, fallbackLanguage) {
    const map = normalizeLocalizedTextMap(value);
    const lang = String(language || '').trim().toLowerCase();
    const fallback = String(fallbackLanguage || '').trim().toLowerCase();
    if (lang && map[lang]) return map[lang];
    if (fallback && map[fallback]) return map[fallback];
    if (map.en) return map.en;
    if (map.pl) return map.pl;
    const first = Object.values(map).find(Boolean);
    return first || '';
  }

  function normalizeChargeType(value) {
    const raw = String(value || '').trim().toLowerCase();
    return HOTEL_EXTRA_CHARGE_TYPES.includes(raw) ? raw : 'per_stay';
  }

  function normalizeExtraItem(rawItem, index) {
    const row = rawItem && typeof rawItem === 'object' ? rawItem : {};
    const amount = normalizeNumber(row.amount);
    if (amount == null || amount < 0) return null;
    const label = normalizeLocalizedTextMap(row.label || row.name);
    if (!Object.keys(label).length) return null;
    const identifier = String(row.id || row.code || `extra-${index + 1}`).trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `extra-${index + 1}`;
    return {
      id: identifier,
      label,
      description: normalizeLocalizedTextMap(row.description),
      amount: roundMoney(amount),
      charge_type: normalizeChargeType(row.charge_type),
      is_mandatory: Boolean(row.is_mandatory),
      sort_order: clampNonNegativeInt(row.sort_order, index),
    };
  }

  function normalizeHotelPricingExtras(rawValue) {
    const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
    const currency = String(raw.currency || 'EUR').trim().toUpperCase() || 'EUR';
    const items = Array.isArray(raw.items)
      ? raw.items.map(normalizeExtraItem).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order)
      : [];
    return { currency, items };
  }

  function sanitizeTimeValue(value) {
    const raw = String(value || '').trim();
    return /^\d{2}:\d{2}$/.test(raw) ? raw : '';
  }

  function normalizeHotelBookingSettings(rawValue) {
    const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
    return {
      check_in_from: sanitizeTimeValue(raw.check_in_from),
      check_out_until: sanitizeTimeValue(raw.check_out_until),
      cancellation_policy: normalizeLocalizedTextMap(raw.cancellation_policy),
      stay_info: normalizeLocalizedTextMap(raw.stay_info),
    };
  }

  function sanitizeCoordinate(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Number(num.toFixed(6)) : null;
  }

  function buildGoogleMapsUrl(latitude, longitude, existingUrl) {
    const explicit = String(existingUrl || '').trim();
    if (explicit) return explicit;
    if (latitude == null || longitude == null) return '';
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  function normalizeHotelLocation(rawValue) {
    const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
    const nestedAddress = raw.address && typeof raw.address === 'object' && !Array.isArray(raw.address) ? raw.address : {};
    const addressLine = String(
      raw.address_line
      || raw.addressLine
      || nestedAddress.line1
      || nestedAddress.address_line
      || '',
    ).trim();
    const district = String(raw.district || raw.area || nestedAddress.district || '').trim();
    const postalCode = String(raw.postal_code || raw.postalCode || nestedAddress.postal_code || '').trim();
    const city = String(raw.city || nestedAddress.city || '').trim();
    const country = String(raw.country || nestedAddress.country || 'Cyprus').trim();
    const latitude = sanitizeCoordinate(raw.latitude ?? raw.lat ?? nestedAddress.latitude ?? nestedAddress.lat);
    const longitude = sanitizeCoordinate(raw.longitude ?? raw.lng ?? raw.lon ?? nestedAddress.longitude ?? nestedAddress.lng ?? nestedAddress.lon);
    const googleMapsUrl = buildGoogleMapsUrl(
      latitude,
      longitude,
      raw.google_maps_url || raw.googleMapsUrl || raw.google_url || nestedAddress.google_maps_url || nestedAddress.google_url,
    );
    const googlePlaceId = String(raw.google_place_id || raw.googlePlaceId || '').trim();
    const summary = [addressLine, district, postalCode, city, country].filter(Boolean).join(', ');
    return {
      address_line: addressLine,
      district,
      postal_code: postalCode,
      city,
      country,
      latitude,
      longitude,
      google_maps_url: googleMapsUrl,
      google_place_id: googlePlaceId,
      summary,
    };
  }

  function normalizePricingModel(value, fallback) {
    const raw = String(value || fallback || 'per_person_per_night').trim().toLowerCase();
    return HOTEL_PRICING_MODELS.includes(raw) ? raw : 'per_person_per_night';
  }

  function normalizePricingTierRule(rawRule) {
    const row = rawRule && typeof rawRule === 'object' ? rawRule : {};
    const persons = clampPositiveInt(row.persons, 1);
    const pricePerNight = normalizeNumber(row.price_per_night);
    if (pricePerNight == null || pricePerNight < 0) return null;
    const minNights = normalizeNumber(row.min_nights);
    const weekdayPrices = normalizeOverrideMap(row.weekday_prices, normalizeWeekdayKey);
    const monthPrices = normalizeOverrideMap(row.month_prices, normalizeMonthKey);
    const datePrices = normalizeDateOverrideMap(row.date_prices || row.date_overrides || row.exact_date_prices);
    const rule = {
      persons,
      price_per_night: roundMoney(pricePerNight),
    };
    if (Number.isFinite(minNights) && minNights > 0) {
      rule.min_nights = Math.round(minNights);
    }
    if (Object.keys(weekdayPrices).length) {
      rule.weekday_prices = weekdayPrices;
    }
    if (Object.keys(monthPrices).length) {
      rule.month_prices = monthPrices;
    }
    if (Object.keys(datePrices).length) {
      rule.date_prices = datePrices;
    }
    return rule;
  }

  function normalizePricingTiers(rawValue) {
    const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
    const rawRules = Array.isArray(raw.rules)
      ? raw.rules
      : (Array.isArray(rawValue) ? rawValue : []);
    const currency = String(raw.currency || 'EUR').trim().toUpperCase() || 'EUR';
    const rules = rawRules
      .map(normalizePricingTierRule)
      .filter(Boolean)
      .sort((a, b) => {
        if (a.persons !== b.persons) return a.persons - b.persons;
        return (Number(a.min_nights) || 0) - (Number(b.min_nights) || 0);
      });
    return { currency, rules };
  }

  function normalizeRatePlanAdjustmentType(value) {
    const raw = String(value || '').trim().toLowerCase();
    return HOTEL_RATE_PLAN_ADJUSTMENT_TYPES.includes(raw) ? raw : 'none';
  }

  function normalizeRatePlanCancellationType(value) {
    const raw = String(value || '').trim().toLowerCase();
    return HOTEL_RATE_PLAN_CANCELLATION_TYPES.includes(raw) ? raw : 'standard';
  }

  function normalizeHotelRatePlan(rawPlan, index) {
    const row = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
    const name = normalizeLocalizedTextMap(row.name || row.title || row.label);
    const fallbackLabel = `Rate plan ${index + 1}`;
    const identifier = normalizeIdentifier(
      row.id || row.code || getLocalizedTextMapValue(name, 'en', 'pl') || fallbackLabel,
      `rate-plan-${index + 1}`,
    );
    const adjustmentType = normalizeRatePlanAdjustmentType(row.price_adjustment_type || row.rate_adjustment_type);
    const adjustmentValue = normalizeNumber(row.price_adjustment_value ?? row.rate_adjustment_value);
    const cancellationType = normalizeRatePlanCancellationType(row.cancellation_policy_type || row.policy_type);
    const nonRefundableBeforeDeposit = Boolean(row.non_refundable_before_deposit) || cancellationType === 'non_refundable_before_deposit';
    return {
      id: identifier,
      name: Object.keys(name).length ? name : { en: fallbackLabel, pl: fallbackLabel },
      summary: normalizeLocalizedTextMap(row.summary || row.description),
      cancellation_policy_type: nonRefundableBeforeDeposit ? 'non_refundable_before_deposit' : 'standard',
      non_refundable_before_deposit: nonRefundableBeforeDeposit,
      cancellation_policy: normalizeLocalizedTextMap(row.cancellation_policy),
      deposit_note: normalizeLocalizedTextMap(row.deposit_note || row.payment_note),
      price_adjustment_type: adjustmentType,
      price_adjustment_value: adjustmentValue != null ? roundMoney(adjustmentValue) : 0,
      sort_order: clampNonNegativeInt(row.sort_order, index),
      is_default: Boolean(row.is_default),
    };
  }

  function createDefaultRatePlan() {
    return normalizeHotelRatePlan({
      id: 'standard',
      name: {
        pl: 'Standard',
        en: 'Standard',
      },
      summary: {
        pl: 'Standardowy plan cenowy.',
        en: 'Standard rate plan.',
      },
      cancellation_policy_type: 'standard',
      price_adjustment_type: 'none',
      price_adjustment_value: 0,
      is_default: true,
    }, 0);
  }

  function normalizeHotelRoomType(rawRoom, index, hotel) {
    const row = rawRoom && typeof rawRoom === 'object' ? rawRoom : {};
    const name = normalizeLocalizedTextMap(row.name || row.title || row.label);
    const fallbackLabel = `Room ${index + 1}`;
    const identifier = normalizeIdentifier(
      row.id || row.code || getLocalizedTextMapValue(name, 'en', 'pl') || fallbackLabel,
      `room-${index + 1}`,
    );
    const pricingTiers = normalizePricingTiers(row.pricing_tiers || row.tiers);
    const ratePlans = Array.isArray(row.rate_plans)
      ? row.rate_plans.map((plan, planIndex) => normalizeHotelRatePlan(plan, planIndex)).filter(Boolean)
      : [];
    const sortedRatePlans = (ratePlans.length ? ratePlans : [createDefaultRatePlan()])
      .sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.sort_order - b.sort_order;
      });
    const roomPhotos = Array.isArray(row.photos)
      ? row.photos
      : (Array.isArray(row.gallery_photos) ? row.gallery_photos : []);
    const normalizedPhotos = roomPhotos
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    const inventoryUnits = clampPositiveInt(
      row.inventory_units
      ?? row.units
      ?? row.room_count
      ?? row.inventory_count,
      0,
    ) || null;
    return {
      id: identifier,
      name: Object.keys(name).length ? name : { en: fallbackLabel, pl: fallbackLabel },
      summary: normalizeLocalizedTextMap(row.summary || row.description),
      cover_image_url: String(row.cover_image_url || row.coverImageUrl || normalizedPhotos[0] || '').trim(),
      photos: normalizedPhotos,
      gallery_photos: normalizedPhotos,
      inventory_units: inventoryUnits,
      max_persons: clampPositiveInt(row.max_persons || row.capacity, clampPositiveInt(hotel && hotel.max_persons, 0)) || null,
      pricing_model: normalizePricingModel(row.pricing_model, hotel && hotel.pricing_model),
      pricing_tiers: pricingTiers,
      rate_plans: sortedRatePlans,
      sort_order: clampNonNegativeInt(row.sort_order, index),
      is_default: Boolean(row.is_default),
    };
  }

  function normalizeHotelRoomTypes(rawValue, hotelFallback) {
    const hotel = hotelFallback && typeof hotelFallback === 'object'
      ? hotelFallback
      : (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {});
    const rawList = Array.isArray(rawValue)
      ? rawValue
      : (Array.isArray(hotel.room_types) ? hotel.room_types : []);
    return rawList
      .map((room, index) => normalizeHotelRoomType(room, index, hotel))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.sort_order - b.sort_order;
      });
  }

  function resolveHotelRoomSelection(hotel, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const roomTypes = normalizeHotelRoomTypes(hotel, hotel);
    const selectedRoomTypeId = String(opts.selectedRoomTypeId || '').trim();
    const selectedRatePlanId = String(opts.selectedRatePlanId || '').trim();
    const roomType = roomTypes.length
      ? (
        roomTypes.find((entry) => entry.id === selectedRoomTypeId)
        || roomTypes.find((entry) => entry.is_default)
        || roomTypes[0]
      )
      : null;
    const ratePlans = Array.isArray(roomType && roomType.rate_plans) ? roomType.rate_plans : [];
    const ratePlan = ratePlans.length
      ? (
        ratePlans.find((entry) => entry.id === selectedRatePlanId)
        || ratePlans.find((entry) => entry.is_default)
        || ratePlans[0]
      )
      : null;
    const roomHasOwnPricing = Boolean(roomType && roomType.pricing_tiers && Array.isArray(roomType.pricing_tiers.rules) && roomType.pricing_tiers.rules.length);
    const pricingSource = roomType && roomHasOwnPricing
      ? {
        pricing_model: roomType.pricing_model || hotel && hotel.pricing_model,
        pricing_tiers: roomType.pricing_tiers,
      }
      : hotel;
    return {
      roomTypes,
      roomType,
      ratePlans,
      ratePlan,
      pricingSource,
      selectedRoomTypeId: roomType ? roomType.id : '',
      selectedRatePlanId: ratePlan ? ratePlan.id : '',
    };
  }

  function getHotelRoomCapacity(hotel, options) {
    const selection = resolveHotelRoomSelection(hotel, options);
    const roomMax = clampPositiveInt(selection.roomType && selection.roomType.max_persons, 0);
    if (roomMax) return roomMax;
    const hotelMax = clampPositiveInt(hotel && hotel.max_persons, 0);
    return hotelMax || null;
  }

  function normalizeSelectedExtraIds(selected) {
    if (Array.isArray(selected)) {
      return Array.from(new Set(selected.map((entry) => String(entry || '').trim()).filter(Boolean)));
    }
    if (selected && typeof selected === 'object' && typeof selected.length === 'number') {
      return Array.from(new Set(Array.from(selected).map((entry) => String(entry || '').trim()).filter(Boolean)));
    }
    if (typeof selected === 'string') {
      const safe = String(selected || '').trim();
      return safe ? [safe] : [];
    }
    return [];
  }

  function calculateHotelExtraAmount(item, context) {
    const row = item && typeof item === 'object' ? item : null;
    if (!row) return 0;
    const amount = Math.max(0, Number(row.amount) || 0);
    const nights = clampPositiveInt(context && context.nights, 1);
    const persons = clampPositiveInt(context && context.persons, 1);
    switch (normalizeChargeType(row.charge_type)) {
      case 'per_night':
        return roundMoney(amount * nights);
      case 'per_person_per_stay':
        return roundMoney(amount * persons);
      case 'per_person_per_night':
        return roundMoney(amount * persons * nights);
      case 'per_stay':
      default:
        return roundMoney(amount);
    }
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
    const model = normalizePricingModel(hotel && hotel.pricing_model, 'per_person_per_night');
    const tiers = normalizePricingTiers(hotel && hotel.pricing_tiers).rules;
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
    const tiers = normalizePricingTiers(hotel && hotel.pricing_tiers).rules.slice();
    return tiers.sort((a, b) => Number(a && a.price_per_night) - Number(b && b.price_per_night))[0] || null;
  }

  function applyRatePlanToNightlyRate(rate, ratePlan) {
    const baseRate = Math.max(0, Number(rate) || 0);
    const plan = ratePlan && typeof ratePlan === 'object' ? ratePlan : null;
    if (!plan) return roundMoney(baseRate);
    const adjustmentType = normalizeRatePlanAdjustmentType(plan.price_adjustment_type);
    const adjustmentValue = Number(plan.price_adjustment_value || 0);
    if (!Number.isFinite(adjustmentValue) || adjustmentValue === 0 || adjustmentType === 'none') {
      return roundMoney(baseRate);
    }
    if (adjustmentType === 'fixed_per_night') {
      return roundMoney(Math.max(0, baseRate + adjustmentValue));
    }
    if (adjustmentType === 'percent') {
      return roundMoney(Math.max(0, baseRate * (1 + adjustmentValue / 100)));
    }
    return roundMoney(baseRate);
  }

  function calculateHotelPrice(hotel, persons, nights, options) {
    const safePersons = clampPositiveInt(persons, 1);
    const safeNights = clampPositiveInt(nights, 1);
    const opts = options && typeof options === 'object' ? options : {};
    const arrivalDate = String(opts.arrivalDate || '').trim();
    const selection = resolveHotelRoomSelection(hotel, opts);
    const pricingSource = selection.pricingSource || hotel;
    const tier = pickRuleForBooking(pricingSource, safePersons, safeNights) || getFallbackRule(pricingSource);
    if (!tier) {
      return {
        total: 0,
        actualTotal: 0,
        baseRoomTotal: 0,
        ratePlanAdjustmentTotal: 0,
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
        pricingModel: normalizePricingModel(pricingSource && pricingSource.pricing_model, hotel && hotel.pricing_model),
        tier: null,
        roomType: selection.roomType || null,
        ratePlan: selection.ratePlan || null,
        selectedRoomTypeId: selection.selectedRoomTypeId || '',
        selectedRatePlanId: selection.selectedRatePlanId || '',
      };
    }

    const stayDates = buildStayDates(arrivalDate, safeNights);
    let nightlyRates = stayDates.map((date) => {
      const info = getNightlyRateForDate(tier, date);
      const finalRate = applyRatePlanToNightlyRate(info.rate, selection.ratePlan);
      return {
        date: formatIsoDate(date),
        baseRate: Number(info.rate || 0),
        rate: Number(finalRate || 0),
        source: info.source,
        weekdayKey: info.weekdayKey,
        monthKey: info.monthKey,
      };
    });

    if (!nightlyRates.length) {
      const fallbackRate = Math.max(0, Number(tier.price_per_night) || 0);
      const finalRate = applyRatePlanToNightlyRate(fallbackRate, selection.ratePlan);
      nightlyRates = Array.from({ length: safeNights }, (_, index) => ({
        date: '',
        baseRate: fallbackRate,
        rate: finalRate,
        source: 'base',
        weekdayKey: '',
        monthKey: '',
        sequence: index + 1,
      }));
    }

    const baseActualTotal = nightlyRates.reduce((sum, entry) => sum + (Number(entry.baseRate) || 0), 0);
    const actualTotal = nightlyRates.reduce((sum, entry) => sum + (Number(entry.rate) || 0), 0);
    const baseAverageNightlyPrice = nightlyRates.length ? baseActualTotal / nightlyRates.length : Math.max(0, Number(tier.price_per_night) || 0);
    const averageNightlyPrice = nightlyRates.length ? actualTotal / nightlyRates.length : applyRatePlanToNightlyRate(Math.max(0, Number(tier.price_per_night) || 0), selection.ratePlan);
    const minimumNightlyPrice = nightlyRates.reduce((min, entry) => Math.min(min, Number(entry.rate) || 0), Number.POSITIVE_INFINITY);
    const maximumNightlyPrice = nightlyRates.reduce((max, entry) => Math.max(max, Number(entry.rate) || 0), 0);
    const minNights = clampPositiveInt(tier.min_nights, 0);
    const billableNights = minNights ? Math.max(minNights, safeNights) : safeNights;
    const extraBillableNights = Math.max(0, billableNights - safeNights);
    const baseRoomTotal = baseActualTotal + extraBillableNights * baseAverageNightlyPrice;
    const total = actualTotal + extraBillableNights * averageNightlyPrice;
    const ratePlanAdjustmentTotal = roundMoney(total - baseRoomTotal);

    return {
      total: Number(total.toFixed(2)),
      actualTotal: Number(actualTotal.toFixed(2)),
      baseRoomTotal: Number(baseRoomTotal.toFixed(2)),
      ratePlanAdjustmentTotal,
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
      usesDatePricing: ruleHasDateOverrides(tier),
      pricingModel: normalizePricingModel(pricingSource && pricingSource.pricing_model, hotel && hotel.pricing_model),
      tier,
      roomType: selection.roomType || null,
      ratePlan: selection.ratePlan || null,
      selectedRoomTypeId: selection.selectedRoomTypeId || '',
      selectedRatePlanId: selection.selectedRatePlanId || '',
    };
  }

  function calculateHotelQuote(hotel, context) {
    const safeContext = context && typeof context === 'object' ? context : {};
    const adults = clampPositiveInt(safeContext.adults, 1);
    const children = clampNonNegativeInt(safeContext.children, 0);
    const requestedPersons = clampPositiveInt(safeContext.persons != null ? safeContext.persons : adults + children, 1);
    const nights = clampPositiveInt(safeContext.nights, 1);
    const selectedExtraIds = normalizeSelectedExtraIds(safeContext.selectedExtraIds);
    const maxPersons = getHotelRoomCapacity(hotel, safeContext);
    const persons = maxPersons ? Math.min(requestedPersons, maxPersons) : requestedPersons;
    const roomPricing = calculateHotelPrice(hotel, persons, nights, {
      arrivalDate: safeContext.arrivalDate,
      departureDate: safeContext.departureDate,
      selectedRoomTypeId: safeContext.selectedRoomTypeId,
      selectedRatePlanId: safeContext.selectedRatePlanId,
    });
    const extrasConfig = normalizeHotelPricingExtras(hotel && hotel.pricing_extras);
    const selectedSet = new Set(selectedExtraIds);
    const appliedExtras = extrasConfig.items
      .filter((item) => item.is_mandatory || selectedSet.has(item.id))
      .map((item) => {
        const total = calculateHotelExtraAmount(item, { nights, persons });
        return {
          id: item.id,
          label: item.label,
          description: item.description,
          amount: item.amount,
          charge_type: item.charge_type,
          is_mandatory: item.is_mandatory,
          total,
        };
      });

    const extrasTotal = roundMoney(appliedExtras.reduce((sum, item) => sum + (Number(item.total) || 0), 0));
    const mandatoryFeesTotal = roundMoney(
      appliedExtras
        .filter((item) => item.is_mandatory)
        .reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    );
    const optionalExtrasTotal = roundMoney(Math.max(0, extrasTotal - mandatoryFeesTotal));
    const roomTotal = roundMoney(roomPricing.total || 0);
    const baseTotal = roundMoney(roomTotal + extrasTotal);

    return {
      adults,
      children,
      requestedPersons,
      persons,
      maxPersons: maxPersons || null,
      capacityExceeded: Boolean(maxPersons && requestedPersons > maxPersons),
      nights,
      selectedExtraIds,
      roomPricing,
      roomTotal,
      extrasConfig,
      appliedExtras,
      extrasTotal,
      mandatoryFeesTotal,
      optionalExtrasTotal,
      total: baseTotal,
      baseTotal,
    };
  }

  function buildHotelBookingBreakdown(hotel, quote, options) {
    const safeQuote = quote && typeof quote === 'object' ? quote : calculateHotelQuote(hotel, options);
    const pricing = safeQuote.roomPricing || {};
    return {
      room_total: roundMoney(safeQuote.roomTotal || 0),
      room_base_total: roundMoney(pricing.baseRoomTotal || 0),
      rate_plan_adjustment_total: roundMoney(pricing.ratePlanAdjustmentTotal || 0),
      extras_total: roundMoney(safeQuote.extrasTotal || 0),
      mandatory_fees_total: roundMoney(safeQuote.mandatoryFeesTotal || 0),
      optional_extras_total: roundMoney(safeQuote.optionalExtrasTotal || 0),
      base_total: roundMoney(safeQuote.baseTotal || safeQuote.total || 0),
      nightly_rates: Array.isArray(pricing.nightlyRates) ? pricing.nightlyRates : [],
      billable_nights: clampPositiveInt(pricing.billableNights || safeQuote.nights, 1),
      requested_nights: clampPositiveInt(safeQuote.nights, 1),
      pricing_model: String(pricing.pricingModel || hotel && hotel.pricing_model || 'per_person_per_night'),
      room_type_id: pricing.selectedRoomTypeId || null,
      room_type_name: pricing.roomType && pricing.roomType.name ? pricing.roomType.name : null,
      room_max_persons: pricing.roomType && pricing.roomType.max_persons ? clampPositiveInt(pricing.roomType.max_persons, 0) : null,
      rate_plan_id: pricing.selectedRatePlanId || null,
      rate_plan_name: pricing.ratePlan && pricing.ratePlan.name ? pricing.ratePlan.name : null,
      rate_plan_cancellation_policy_type: pricing.ratePlan && pricing.ratePlan.cancellation_policy_type ? pricing.ratePlan.cancellation_policy_type : null,
      selected_extra_ids: normalizeSelectedExtraIds(safeQuote.selectedExtraIds),
      applied_extras: Array.isArray(safeQuote.appliedExtras)
        ? safeQuote.appliedExtras.map((item) => ({
          id: item.id,
          label: item.label,
          amount: roundMoney(item.amount || 0),
          total: roundMoney(item.total || 0),
          charge_type: item.charge_type,
          is_mandatory: Boolean(item.is_mandatory),
        }))
        : [],
    };
  }

  async function checkHotelAvailability(supabaseClient, hotel, options) {
    const client = supabaseClient && typeof supabaseClient.rpc === 'function' ? supabaseClient : null;
    const hotelId = String(hotel && hotel.id || '').trim();
    const opts = options && typeof options === 'object' ? options : {};
    const arrivalDate = String(opts.arrivalDate || '').trim();
    const departureDate = String(opts.departureDate || '').trim();
    if (!client) {
      throw new Error('Supabase client not available');
    }
    if (!hotelId || !arrivalDate || !departureDate) {
      return { hasDates: false, available: true, reason: 'missing_dates', booking_conflicts: 0, availability_blocks: 0 };
    }
    const arrival = parseIsoDate(arrivalDate);
    const departure = parseIsoDate(departureDate);
    if (!arrival || !departure || departure.getTime() <= arrival.getTime()) {
      return { hasDates: true, available: false, reason: 'invalid_range', booking_conflicts: 0, availability_blocks: 0 };
    }
    const { data, error } = await client.rpc('hotel_check_availability', {
      p_hotel_id: hotelId,
      p_arrival_date: arrivalDate,
      p_departure_date: departureDate,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      hasDates: true,
      available: Boolean(row && row.is_available),
      reason: String(row && row.reason || '').trim(),
      booking_conflicts: clampNonNegativeInt(row && row.booking_conflicts, 0),
      availability_blocks: clampNonNegativeInt(row && row.availability_blocks, 0),
    };
  }

  function getPricingPreviewSelections(hotel, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const roomTypes = normalizeHotelRoomTypes(hotel, hotel);
    if (!roomTypes.length) {
      return [{
        pricingSource: hotel,
        roomType: null,
        ratePlan: null,
      }];
    }

    const selectedRoomTypeId = String(opts.selectedRoomTypeId || '').trim();
    const selectedRatePlanId = String(opts.selectedRatePlanId || '').trim();
    const candidateRooms = selectedRoomTypeId
      ? roomTypes.filter((room) => room.id === selectedRoomTypeId)
      : roomTypes;

    const selections = [];
    candidateRooms.forEach((roomType) => {
      const ratePlans = Array.isArray(roomType.rate_plans) && roomType.rate_plans.length
        ? roomType.rate_plans
        : [createDefaultRatePlan()];
      const candidatePlans = selectedRoomTypeId && selectedRatePlanId
        ? ratePlans.filter((plan) => plan.id === selectedRatePlanId)
        : ratePlans;
      candidatePlans.forEach((ratePlan) => {
        selections.push({
          pricingSource: {
            pricing_model: roomType.pricing_model,
            pricing_tiers: roomType.pricing_tiers,
          },
          roomType,
          ratePlan,
        });
      });
    });
    return selections.length ? selections : [{
      pricingSource: hotel,
      roomType: null,
      ratePlan: null,
    }];
  }

  function getHotelMinPricePerNight(hotel, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const preferredPersons = normalizeNumber(opts.preferredPersons);
    let minRate = Number.POSITIVE_INFINITY;
    getPricingPreviewSelections(hotel, opts).forEach((selection) => {
      const rules = normalizePricingTiers(selection.pricingSource && selection.pricingSource.pricing_tiers).rules;
      if (!rules.length) return;
      const candidateRules = preferredPersons != null
        ? rules.filter((rule) => Number(rule && rule.persons) === preferredPersons)
        : [];
      const relevant = candidateRules.length ? candidateRules : rules;
      relevant.forEach((rule) => {
        const rate = getRuleMinNightlyRate(rule);
        if (rate == null) return;
        const finalRate = applyRatePlanToNightlyRate(rate, selection.ratePlan);
        if (finalRate < minRate) {
          minRate = finalRate;
        }
      });
    });
    return Number.isFinite(minRate) ? Number(minRate.toFixed(2)) : null;
  }

  function getHotelMaxPricePerNight(hotel, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const preferredPersons = normalizeNumber(opts.preferredPersons);
    let maxRate = 0;
    getPricingPreviewSelections(hotel, opts).forEach((selection) => {
      const rules = normalizePricingTiers(selection.pricingSource && selection.pricingSource.pricing_tiers).rules;
      if (!rules.length) return;
      const candidateRules = preferredPersons != null
        ? rules.filter((rule) => Number(rule && rule.persons) === preferredPersons)
        : [];
      const relevant = candidateRules.length ? candidateRules : rules;
      relevant.forEach((rule) => {
        const rate = getRuleMaxNightlyRate(rule);
        if (rate == null) return;
        const finalRate = applyRatePlanToNightlyRate(rate, selection.ratePlan);
        if (finalRate > maxRate) {
          maxRate = finalRate;
        }
      });
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
    calculateHotelQuote,
    getHotelMinPricePerNight,
    getHotelMaxPricePerNight,
    getHotelRoomCapacity,
    buildPricingPreviewLabel,
    buildHotelBookingBreakdown,
    normalizeHotelBookingSettings,
    normalizeHotelPricingExtras,
    normalizeHotelLocation,
    normalizeHotelRoomTypes,
    normalizeSelectedExtraIds,
    getLocalizedTextMapValue,
    resolveHotelRoomSelection,
    checkHotelAvailability,
    getRuleDateOverrides,
    getRuleWeekdayOverrides,
    getRuleMonthOverrides,
    getNightlyRateForDate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
