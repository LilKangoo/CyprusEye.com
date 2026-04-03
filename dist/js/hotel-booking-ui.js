(function attachHotelBookingUi(globalScope) {
  'use strict';

  function getPricingApi() {
    return globalScope.CE_HOTEL_PRICING || null;
  }

  function getLanguage() {
    const lang = String(
      globalScope.appI18n?.language
      || globalScope.getCurrentLanguage?.()
      || globalScope.document?.documentElement?.lang
      || 'pl'
    ).trim().toLowerCase();
    return lang || 'pl';
  }

  function formatMoney(value, currency) {
    const amount = Number(value || 0);
    const code = String(currency || 'EUR').trim().toUpperCase() || 'EUR';
    if (!Number.isFinite(amount)) return `0.00 ${code}`;
    return `${amount.toFixed(2)} ${code}`;
  }

  function localizeText(value, language) {
    const api = getPricingApi();
    if (api?.getLocalizedTextMapValue) {
      return api.getLocalizedTextMapValue(value, language || getLanguage(), 'en');
    }
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      return value[language] || value.en || value.pl || Object.values(value)[0] || '';
    }
    return '';
  }

  function getChargeTypeLabel(chargeType, language) {
    const lang = String(language || getLanguage()).toLowerCase();
    const map = {
      per_stay: lang.startsWith('en') ? 'per stay' : 'za pobyt',
      per_night: lang.startsWith('en') ? 'per night' : 'za noc',
      per_person_per_stay: lang.startsWith('en') ? 'per person / stay' : 'za osobę / pobyt',
      per_person_per_night: lang.startsWith('en') ? 'per person / night' : 'za osobę / noc',
    };
    return map[String(chargeType || 'per_stay').trim()] || map.per_stay;
  }

  function getBookingSettings(hotel) {
    const api = getPricingApi();
    return api?.normalizeHotelBookingSettings
      ? api.normalizeHotelBookingSettings(hotel && hotel.booking_settings)
      : {
        check_in_from: '',
        check_out_until: '',
        cancellation_policy: {},
        stay_info: {},
      };
  }

  function getPricingExtras(hotel) {
    const api = getPricingApi();
    return api?.normalizeHotelPricingExtras
      ? api.normalizeHotelPricingExtras(hotel && hotel.pricing_extras)
      : { currency: 'EUR', items: [] };
  }

  function getSelectedExtraIds(form, inputName) {
    if (!(form instanceof HTMLFormElement)) return [];
    const name = String(inputName || 'hotel_extra_ids').trim() || 'hotel_extra_ids';
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`))
      .map((input) => String(input.value || '').trim())
      .filter(Boolean);
  }

  function calculateQuoteFromForm(hotel, form, options) {
    const fd = form instanceof HTMLFormElement ? new FormData(form) : null;
    const ctx = {
      arrivalDate: fd ? String(fd.get('arrival_date') || '') : String(options?.arrivalDate || ''),
      departureDate: fd ? String(fd.get('departure_date') || '') : String(options?.departureDate || ''),
      adults: fd ? Number(fd.get('adults') || 1) : Number(options?.adults || 1),
      children: fd ? Number(fd.get('children') || 0) : Number(options?.children || 0),
      nights: Number(options?.nights || 1),
      selectedExtraIds: fd ? getSelectedExtraIds(form, options?.inputName) : (options?.selectedExtraIds || []),
    };
    const api = getPricingApi();
    if (!api?.calculateHotelQuote) {
      return {
        roomPricing: api?.calculateHotelPrice ? api.calculateHotelPrice(hotel, ctx.adults + ctx.children, ctx.nights, ctx) : { total: 0 },
        roomTotal: 0,
        extrasTotal: 0,
        mandatoryFeesTotal: 0,
        optionalExtrasTotal: 0,
        total: 0,
        baseTotal: 0,
        selectedExtraIds: ctx.selectedExtraIds,
        appliedExtras: [],
      };
    }
    return api.calculateHotelQuote(hotel, {
      arrivalDate: ctx.arrivalDate,
      departureDate: ctx.departureDate,
      adults: ctx.adults,
      children: ctx.children,
      persons: ctx.adults + ctx.children,
      nights: ctx.nights,
      selectedExtraIds: ctx.selectedExtraIds,
    });
  }

  function renderPolicySummary(container, hotel, options) {
    const target = container instanceof Element ? container : null;
    if (!target) return false;
    const language = options?.language || getLanguage();
    const settings = getBookingSettings(hotel);
    const rows = [];
    if (settings.check_in_from) {
      rows.push({
        label: language.startsWith('en') ? 'Check-in from' : 'Check-in od',
        value: settings.check_in_from,
      });
    }
    if (settings.check_out_until) {
      rows.push({
        label: language.startsWith('en') ? 'Check-out until' : 'Check-out do',
        value: settings.check_out_until,
      });
    }
    const cancellationText = localizeText(settings.cancellation_policy, language);
    if (cancellationText) {
      rows.push({
        label: language.startsWith('en') ? 'Cancellation' : 'Anulacja',
        value: cancellationText,
      });
    }
    const stayInfoText = localizeText(settings.stay_info, language);
    if (stayInfoText) {
      rows.push({
        label: language.startsWith('en') ? 'Stay info' : 'Informacje o pobycie',
        value: stayInfoText,
      });
    }
    if (!rows.length) {
      target.hidden = true;
      target.innerHTML = '';
      return false;
    }
    target.hidden = false;
    target.innerHTML = `
      <div style="display:grid; gap:10px; padding:14px 16px; border:1px solid rgba(148,163,184,.24); border-radius:14px; background:rgba(241,245,249,.75); margin:0 0 16px;">
        ${rows.map((row) => `
          <div style="display:grid; gap:4px;">
            <strong style="font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#475569;">${row.label}</strong>
            <span style="font-size:14px; color:#0f172a;">${row.value}</span>
          </div>
        `).join('')}
      </div>
    `;
    return true;
  }

  function renderExtraOptions(container, hotel, options) {
    const target = container instanceof Element ? container : null;
    if (!target) return false;
    const language = options?.language || getLanguage();
    const inputName = String(options?.inputName || 'hotel_extra_ids').trim() || 'hotel_extra_ids';
    const selected = new Set(Array.isArray(options?.selectedExtraIds) ? options.selectedExtraIds : []);
    const extras = getPricingExtras(hotel);
    const mandatory = extras.items.filter((item) => item.is_mandatory);
    const optional = extras.items.filter((item) => !item.is_mandatory);
    if (!mandatory.length && !optional.length) {
      target.hidden = true;
      target.innerHTML = '';
      return false;
    }

    const titleIncluded = language.startsWith('en') ? 'Included in quote' : 'Wliczone do wyceny';
    const titleOptional = language.startsWith('en') ? 'Optional extras' : 'Dodatki opcjonalne';

    target.hidden = false;
    target.innerHTML = `
      <div style="display:grid; gap:12px; margin:0 0 16px;">
        ${mandatory.length ? `
        <div style="display:grid; gap:8px; padding:14px 16px; border:1px solid rgba(148,163,184,.24); border-radius:14px; background:rgba(248,250,252,.95);">
          <strong style="font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#475569;">${titleIncluded}</strong>
          ${mandatory.map((item) => `
            <div style="display:flex; justify-content:space-between; gap:12px; font-size:14px; color:#0f172a;">
              <span>${localizeText(item.label, language)} <span style="color:#64748b;">(${getChargeTypeLabel(item.charge_type, language)})</span></span>
              <strong>${formatMoney(item.amount, extras.currency)}</strong>
            </div>
          `).join('')}
        </div>
        ` : ''}
        ${optional.length ? `
        <div style="display:grid; gap:8px; padding:14px 16px; border:1px solid rgba(148,163,184,.24); border-radius:14px; background:rgba(248,250,252,.95);">
          <strong style="font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#475569;">${titleOptional}</strong>
          ${optional.map((item) => `
            <label style="display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:start; font-size:14px; color:#0f172a;">
              <input type="checkbox" name="${inputName}" value="${item.id}" ${selected.has(item.id) ? 'checked' : ''} />
              <span>${localizeText(item.label, language)} <span style="color:#64748b;">(${getChargeTypeLabel(item.charge_type, language)})</span></span>
              <strong>${formatMoney(item.amount, extras.currency)}</strong>
            </label>
          `).join('')}
        </div>
        ` : ''}
      </div>
    `;

    if (typeof options?.onChange === 'function') {
      target.querySelectorAll(`input[name="${inputName}"]`).forEach((input) => {
        input.addEventListener('change', options.onChange);
      });
    }
    return true;
  }

  function buildBookingSnapshot(hotel, quote, options) {
    const api = getPricingApi();
    const language = options?.language || getLanguage();
    const settings = getBookingSettings(hotel);
    const pricingBreakdown = api?.buildHotelBookingBreakdown
      ? api.buildHotelBookingBreakdown(hotel, quote, options)
      : {};
    return {
      extras_price: Number(quote?.extrasTotal || 0),
      selected_extras: Array.isArray(quote?.selectedExtraIds) ? quote.selectedExtraIds.slice() : [],
      pricing_breakdown: pricingBreakdown,
      booking_details: {
        check_in_from: settings.check_in_from || null,
        check_out_until: settings.check_out_until || null,
        cancellation_policy: settings.cancellation_policy || {},
        cancellation_policy_text: localizeText(settings.cancellation_policy, language) || null,
        stay_info: settings.stay_info || {},
        stay_info_text: localizeText(settings.stay_info, language) || null,
        booking_language: language,
      },
    };
  }

  globalScope.CE_HOTEL_BOOKING_UI = {
    getLanguage,
    formatMoney,
    localizeText,
    getChargeTypeLabel,
    getBookingSettings,
    getPricingExtras,
    getSelectedExtraIds,
    calculateQuoteFromForm,
    renderPolicySummary,
    renderExtraOptions,
    buildBookingSnapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
