(function attachHotelBookingUi(globalScope) {
  'use strict';

  function getPricingApi() {
    return globalScope.CE_HOTEL_PRICING || null;
  }

  function isFormElement(value) {
    if (!value || typeof value !== 'object') return false;
    if (typeof globalScope.HTMLFormElement === 'function') {
      return value instanceof globalScope.HTMLFormElement;
    }
    return typeof value.querySelector === 'function' && value.elements && typeof value.elements === 'object';
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

  function getLocation(hotel) {
    const api = getPricingApi();
    return api?.normalizeHotelLocation
      ? api.normalizeHotelLocation(hotel)
      : {
        address_line: '',
        district: '',
        postal_code: '',
        city: String(hotel?.city || '').trim(),
        country: 'Cyprus',
        latitude: null,
        longitude: null,
        google_maps_url: '',
        google_place_id: '',
        summary: String(hotel?.city || '').trim(),
      };
  }

  function getSelectedExtraIds(form, inputName) {
    if (!isFormElement(form)) return [];
    const name = String(inputName || 'hotel_extra_ids').trim() || 'hotel_extra_ids';
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`))
      .map((input) => String(input.value || '').trim())
      .filter(Boolean);
  }

  function getSelectedRoomTypeId(form, inputName) {
    if (!isFormElement(form)) return '';
    const name = String(inputName || 'hotel_room_type_id').trim() || 'hotel_room_type_id';
    const field = form.querySelector(`[name="${name}"]`);
    return String(field?.value || '').trim();
  }

  function getSelectedRatePlanId(form, inputName) {
    if (!isFormElement(form)) return '';
    const name = String(inputName || 'hotel_rate_plan_id').trim() || 'hotel_rate_plan_id';
    const field = form.querySelector(`[name="${name}"]`);
    return String(field?.value || '').trim();
  }

  function getRoomSelection(hotel, options) {
    const api = getPricingApi();
    const safeOptions = options && typeof options === 'object' ? options : {};
    const form = isFormElement(safeOptions.form) ? safeOptions.form : null;
    const roomInputName = String(safeOptions.roomInputName || 'hotel_room_type_id').trim() || 'hotel_room_type_id';
    const ratePlanInputName = String(safeOptions.ratePlanInputName || 'hotel_rate_plan_id').trim() || 'hotel_rate_plan_id';
    const selectedRoomTypeId = String(
      safeOptions.selectedRoomTypeId != null
        ? safeOptions.selectedRoomTypeId
        : getSelectedRoomTypeId(form, roomInputName)
    ).trim();
    const selectedRatePlanId = String(
      safeOptions.selectedRatePlanId != null
        ? safeOptions.selectedRatePlanId
        : getSelectedRatePlanId(form, ratePlanInputName)
    ).trim();

    if (api?.resolveHotelRoomSelection) {
      return api.resolveHotelRoomSelection(hotel, { selectedRoomTypeId, selectedRatePlanId });
    }

    return {
      roomTypes: [],
      roomType: null,
      ratePlans: [],
      ratePlan: null,
      pricingSource: hotel,
      selectedRoomTypeId: '',
      selectedRatePlanId: '',
    };
  }

  function getRoomCapacity(hotel, options) {
    const api = getPricingApi();
    const selection = getRoomSelection(hotel, options);
    if (api?.getHotelRoomCapacity) {
      return api.getHotelRoomCapacity(hotel, {
        selectedRoomTypeId: selection.selectedRoomTypeId,
        selectedRatePlanId: selection.selectedRatePlanId,
      });
    }
    const max = Number(hotel?.max_persons || 0);
    return Number.isFinite(max) && max > 0 ? max : null;
  }

  function getDefaultNonRefundableText(language) {
    return String(language || getLanguage()).startsWith('en')
      ? 'Non-refundable if a deposit or prepayment is required to confirm this booking.'
      : 'Bezzwrotna, jeśli do potwierdzenia rezerwacji będzie wymagana przedpłata lub depozyt.';
  }

  function getSelectionSummary(hotel, options) {
    const language = options?.language || getLanguage();
    const selection = getRoomSelection(hotel, options);
    const settings = getBookingSettings(hotel);
    const roomTypeName = selection.roomType ? localizeText(selection.roomType.name, language) : '';
    const roomSummary = selection.roomType ? localizeText(selection.roomType.summary, language) : '';
    const ratePlanName = selection.ratePlan ? localizeText(selection.ratePlan.name, language) : '';
    const ratePlanSummary = selection.ratePlan ? localizeText(selection.ratePlan.summary, language) : '';
    const depositNote = selection.ratePlan ? localizeText(selection.ratePlan.deposit_note, language) : '';
    const ratePlanCancellationText = selection.ratePlan ? localizeText(selection.ratePlan.cancellation_policy, language) : '';
    const cancellationText = selection.ratePlan?.non_refundable_before_deposit
      ? (ratePlanCancellationText || getDefaultNonRefundableText(language))
      : (ratePlanCancellationText || localizeText(settings.cancellation_policy, language));
    return {
      selection,
      roomTypeName,
      roomSummary,
      ratePlanName,
      ratePlanSummary,
      depositNote,
      cancellationText,
    };
  }

  function syncGuestCapacityInputs(form, hotel, options) {
    if (!isFormElement(form)) return null;
    const maxPersons = getRoomCapacity(hotel, { ...options, form });
    const adultsField = form.querySelector('[name="adults"]');
    const childrenField = form.querySelector('[name="children"]');
    if (maxPersons) {
      adultsField?.setAttribute('max', String(maxPersons));
      childrenField?.setAttribute('max', String(Math.max(0, maxPersons - 1)));
    } else {
      adultsField?.removeAttribute('max');
      childrenField?.removeAttribute('max');
    }
    return maxPersons;
  }

  function calculateQuoteFromForm(hotel, form, options) {
    const fd = isFormElement(form) ? new FormData(form) : null;
    const roomInputName = String(options?.roomInputName || 'hotel_room_type_id').trim() || 'hotel_room_type_id';
    const ratePlanInputName = String(options?.ratePlanInputName || 'hotel_rate_plan_id').trim() || 'hotel_rate_plan_id';
    const ctx = {
      arrivalDate: fd ? String(fd.get('arrival_date') || '') : String(options?.arrivalDate || ''),
      departureDate: fd ? String(fd.get('departure_date') || '') : String(options?.departureDate || ''),
      adults: fd ? Number(fd.get('adults') || 1) : Number(options?.adults || 1),
      children: fd ? Number(fd.get('children') || 0) : Number(options?.children || 0),
      nights: Number(options?.nights || 1),
      selectedExtraIds: fd ? getSelectedExtraIds(form, options?.inputName) : (options?.selectedExtraIds || []),
      selectedRoomTypeId: fd ? getSelectedRoomTypeId(form, roomInputName) : String(options?.selectedRoomTypeId || '').trim(),
      selectedRatePlanId: fd ? getSelectedRatePlanId(form, ratePlanInputName) : String(options?.selectedRatePlanId || '').trim(),
    };
    const api = getPricingApi();
    if (!api?.calculateHotelQuote) {
      return {
        roomPricing: api?.calculateHotelPrice
          ? api.calculateHotelPrice(hotel, ctx.adults + ctx.children, ctx.nights, ctx)
          : { total: 0 },
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
      selectedRoomTypeId: ctx.selectedRoomTypeId,
      selectedRatePlanId: ctx.selectedRatePlanId,
    });
  }

  function renderLocationSummary(container, hotel, options) {
    const target = container instanceof Element ? container : null;
    if (!target) return false;
    const language = options?.language || getLanguage();
    const location = getLocation(hotel);
    const summary = String(location.summary || '').trim();
    const hasCoords = Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
    const mapsUrl = String(location.google_maps_url || '').trim();
    if (!summary && !mapsUrl && !hasCoords) {
      target.hidden = true;
      target.innerHTML = '';
      return false;
    }

    const title = language.startsWith('en') ? 'Location' : 'Lokalizacja';
    const mapLabel = language.startsWith('en') ? 'Open in Google Maps' : 'Otwórz w Google Maps';
    const coordsLabel = language.startsWith('en') ? 'Coordinates' : 'Współrzędne';
    const coords = hasCoords ? `${location.latitude}, ${location.longitude}` : '';

    target.hidden = false;
    target.innerHTML = `
      <div style="display:grid; gap:10px; padding:14px 16px; border:1px solid rgba(148,163,184,.24); border-radius:14px; background:rgba(248,250,252,.92); margin:0 0 16px;">
        <strong style="font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#475569;">${title}</strong>
        ${summary ? `<span style="font-size:14px; color:#0f172a;">${summary}</span>` : ''}
        ${coords ? `<span style="font-size:12px; color:#64748b;">${coordsLabel}: ${coords}</span>` : ''}
        ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; justify-content:center; width:max-content; padding:10px 14px; border-radius:12px; text-decoration:none; font-weight:600; color:#0f172a; background:#e2e8f0;">${mapLabel}</a>` : ''}
      </div>
    `;
    return true;
  }

  function renderRoomTypeOptions(container, hotel, options) {
    const target = container instanceof Element ? container : null;
    if (!target) return false;
    const language = options?.language || getLanguage();
    const form = isFormElement(options?.form) ? options.form : target.closest('form');
    const roomInputName = String(options?.roomInputName || 'hotel_room_type_id').trim() || 'hotel_room_type_id';
    const ratePlanInputName = String(options?.ratePlanInputName || 'hotel_rate_plan_id').trim() || 'hotel_rate_plan_id';
    const api = getPricingApi();
    const summary = getSelectionSummary(hotel, {
      ...options,
      form,
      roomInputName,
      ratePlanInputName,
      language,
    });
    const roomTypes = Array.isArray(summary.selection.roomTypes) ? summary.selection.roomTypes : [];
    const roomType = summary.selection.roomType || null;
    const ratePlans = Array.isArray(summary.selection.ratePlans) ? summary.selection.ratePlans : [];
    const ratePlan = summary.selection.ratePlan || null;
    if (!roomTypes.length || !roomType) {
      target.hidden = true;
      target.innerHTML = '';
      return false;
    }

    const title = language.startsWith('en') ? 'Room & rate plan' : 'Pokój i plan cenowy';
    const roomLabel = language.startsWith('en') ? 'Room type' : 'Typ pokoju';
    const planLabel = language.startsWith('en') ? 'Rate plan' : 'Plan cenowy';
    const guestsLabel = language.startsWith('en') ? 'Up to' : 'Do';
    const guestsSuffix = language.startsWith('en') ? 'guests' : 'osób';
    const roomSummaryLabel = language.startsWith('en') ? 'Room details' : 'Szczegóły pokoju';
    const planSummaryLabel = language.startsWith('en') ? 'Plan details' : 'Szczegóły planu';
    const pricePreviewLabel = language.startsWith('en') ? 'Selected plan from' : 'Plan od';
    const previewPrice = api?.getHotelMinPricePerNight
      ? api.getHotelMinPricePerNight(hotel, {
        preferredPersons: Math.min(Number(roomType.max_persons || 2) || 2, 2),
        selectedRoomTypeId: roomType.id,
        selectedRatePlanId: ratePlan?.id || '',
      })
      : null;

    target.hidden = false;
    target.innerHTML = `
      <div style="display:grid; gap:12px; margin:0 0 16px; padding:14px 16px; border:1px solid rgba(148,163,184,.24); border-radius:14px; background:rgba(248,250,252,.95);">
        <strong style="font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#475569;">${title}</strong>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px;">
          <label style="display:grid; gap:6px; font-size:13px; color:#334155;">
            <span>${roomLabel}</span>
            <select name="${roomInputName}" style="padding:12px; border-radius:12px; border:1px solid rgba(148,163,184,.35); background:#fff; color:#0f172a;">
              ${roomTypes.map((entry) => {
                const label = localizeText(entry.name, language) || entry.id;
                const cap = entry.max_persons ? ` · ${guestsLabel} ${entry.max_persons} ${guestsSuffix}` : '';
                return `<option value="${entry.id}" ${entry.id === roomType.id ? 'selected' : ''}>${label}${cap}</option>`;
              }).join('')}
            </select>
          </label>
          ${ratePlans.length ? `
          <label style="display:grid; gap:6px; font-size:13px; color:#334155;">
            <span>${planLabel}</span>
            <select name="${ratePlanInputName}" style="padding:12px; border-radius:12px; border:1px solid rgba(148,163,184,.35); background:#fff; color:#0f172a;">
              ${ratePlans.map((entry) => {
                const label = localizeText(entry.name, language) || entry.id;
                return `<option value="${entry.id}" ${entry.id === ratePlan?.id ? 'selected' : ''}>${label}</option>`;
              }).join('')}
            </select>
          </label>
          ` : ''}
        </div>
        <div style="display:grid; gap:8px;">
          ${summary.roomTypeName ? `
          <div style="display:grid; gap:4px;">
            <strong style="font-size:12px; color:#475569;">${roomSummaryLabel}</strong>
            <span style="font-size:14px; color:#0f172a;">${summary.roomTypeName}${roomType.max_persons ? ` · ${guestsLabel} ${roomType.max_persons} ${guestsSuffix}` : ''}</span>
            ${summary.roomSummary ? `<span style="font-size:13px; color:#475569;">${summary.roomSummary}</span>` : ''}
          </div>
          ` : ''}
          ${summary.ratePlanName ? `
          <div style="display:grid; gap:4px;">
            <strong style="font-size:12px; color:#475569;">${planSummaryLabel}</strong>
            <span style="font-size:14px; color:#0f172a;">${summary.ratePlanName}</span>
            ${summary.ratePlanSummary ? `<span style="font-size:13px; color:#475569;">${summary.ratePlanSummary}</span>` : ''}
            ${summary.selection.ratePlan?.non_refundable_before_deposit ? `<span style="display:inline-flex; width:max-content; padding:6px 10px; border-radius:999px; background:#fee2e2; color:#991b1b; font-size:12px; font-weight:700;">${language.startsWith('en') ? 'Non-refundable before deposit' : 'Bezzwrotna przed wpłatą / depozytem'}</span>` : ''}
            ${summary.depositNote ? `<span style="font-size:12px; color:#64748b;">${summary.depositNote}</span>` : ''}
          </div>
          ` : ''}
          ${Number.isFinite(previewPrice) ? `<span style="font-size:13px; color:#0f172a; font-weight:600;">${pricePreviewLabel}: ${formatMoney(previewPrice, 'EUR')}</span>` : ''}
        </div>
      </div>
    `;

    const roomSelect = target.querySelector(`select[name="${roomInputName}"]`);
    const ratePlanSelect = target.querySelector(`select[name="${ratePlanInputName}"]`);
    roomSelect?.addEventListener('change', () => {
      renderRoomTypeOptions(target, hotel, {
        ...options,
        form,
        roomInputName,
        ratePlanInputName,
        selectedRoomTypeId: roomSelect.value,
        selectedRatePlanId: '',
      });
      syncGuestCapacityInputs(form, hotel, {
        roomInputName,
        ratePlanInputName,
        selectedRoomTypeId: roomSelect.value,
      });
      if (typeof options?.onChange === 'function') {
        options.onChange();
      }
    });
    ratePlanSelect?.addEventListener('change', () => {
      syncGuestCapacityInputs(form, hotel, {
        roomInputName,
        ratePlanInputName,
        selectedRoomTypeId: roomSelect?.value || roomType.id,
        selectedRatePlanId: ratePlanSelect.value,
      });
      if (typeof options?.onChange === 'function') {
        options.onChange();
      }
    });

    syncGuestCapacityInputs(form, hotel, {
      roomInputName,
      ratePlanInputName,
      selectedRoomTypeId: roomType.id,
      selectedRatePlanId: ratePlan?.id || '',
    });
    return true;
  }

  function renderPolicySummary(container, hotel, options) {
    const target = container instanceof Element ? container : null;
    if (!target) return false;
    const language = options?.language || getLanguage();
    const settings = getBookingSettings(hotel);
    const selection = getSelectionSummary(hotel, options);
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
    if (selection.cancellationText) {
      rows.push({
        label: language.startsWith('en') ? 'Cancellation' : 'Anulacja',
        value: selection.cancellationText,
      });
    }
    if (selection.depositNote) {
      rows.push({
        label: language.startsWith('en') ? 'Deposit rule' : 'Zasada przedpłaty',
        value: selection.depositNote,
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
    const roomInputName = String(options?.roomInputName || 'hotel_room_type_id').trim() || 'hotel_room_type_id';
    const ratePlanInputName = String(options?.ratePlanInputName || 'hotel_rate_plan_id').trim() || 'hotel_rate_plan_id';
    const selection = getRoomSelection(hotel, {
      ...options,
      selectedRoomTypeId: quote?.roomPricing?.selectedRoomTypeId || options?.selectedRoomTypeId,
      selectedRatePlanId: quote?.roomPricing?.selectedRatePlanId || options?.selectedRatePlanId,
      roomInputName,
      ratePlanInputName,
    });
    const selectionSummary = getSelectionSummary(hotel, {
      ...options,
      selectedRoomTypeId: selection.selectedRoomTypeId,
      selectedRatePlanId: selection.selectedRatePlanId,
      roomInputName,
      ratePlanInputName,
      language,
    });
    const location = getLocation(hotel);
    const pricingBreakdown = api?.buildHotelBookingBreakdown
      ? api.buildHotelBookingBreakdown(hotel, quote, options)
      : {};
    return {
      room_type_id: selection.roomType?.id || null,
      room_type_name: selection.roomType?.name || null,
      rate_plan_id: selection.ratePlan?.id || null,
      rate_plan_name: selection.ratePlan?.name || null,
      cancellation_policy_type: selection.ratePlan?.cancellation_policy_type || null,
      extras_price: Number(quote?.extrasTotal || 0),
      selected_extras: Array.isArray(quote?.selectedExtraIds) ? quote.selectedExtraIds.slice() : [],
      pricing_breakdown: pricingBreakdown,
      booking_details: {
        check_in_from: settings.check_in_from || null,
        check_out_until: settings.check_out_until || null,
        cancellation_policy: settings.cancellation_policy || {},
        cancellation_policy_text: selectionSummary.cancellationText || localizeText(settings.cancellation_policy, language) || null,
        cancellation_policy_type: selection.ratePlan?.cancellation_policy_type || null,
        stay_info: settings.stay_info || {},
        stay_info_text: localizeText(settings.stay_info, language) || null,
        booking_language: language,
        room_type_id: selection.roomType?.id || null,
        room_type_name: selection.roomType?.name || null,
        room_type_summary: selection.roomType?.summary || {},
        room_max_persons: selection.roomType?.max_persons || null,
        rate_plan_id: selection.ratePlan?.id || null,
        rate_plan_name: selection.ratePlan?.name || null,
        rate_plan_summary: selection.ratePlan?.summary || {},
        rate_plan_price_adjustment_type: selection.ratePlan?.price_adjustment_type || null,
        rate_plan_price_adjustment_value: selection.ratePlan?.price_adjustment_value ?? null,
        non_refundable_before_deposit: Boolean(selection.ratePlan?.non_refundable_before_deposit),
        deposit_note: selection.ratePlan?.deposit_note || {},
        deposit_note_text: selectionSummary.depositNote || null,
        hotel_location: location,
        hotel_maps_url: location.google_maps_url || null,
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
    getLocation,
    getRoomSelection,
    getRoomCapacity,
    getSelectedExtraIds,
    getSelectedRoomTypeId,
    getSelectedRatePlanId,
    syncGuestCapacityInputs,
    calculateQuoteFromForm,
    renderLocationSummary,
    renderRoomTypeOptions,
    renderPolicySummary,
    renderExtraOptions,
    buildBookingSnapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
