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
    let queryLang = '';
    try {
      queryLang = String(new URLSearchParams(globalScope.location?.search || '').get('lang') || '').trim().toLowerCase();
    } catch (_) {}
    const lang = String(
      globalScope.appI18n?.language
      || globalScope.getCurrentLanguage?.()
      || queryLang
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

  function escapeAttribute(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const HOTEL_LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const HOTEL_LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  let hotelLeafletLoadPromise = null;
  let hotelLocationMapCounter = 0;
  const hotelLocationMapState = new WeakMap();
  let hotelAmenitiesCatalog = {};
  let hotelAmenitiesLoadPromise = null;
  const HOTEL_AMENITY_FALLBACK_LABELS = {
    accessibility: { pl: 'Dostępność dla niepełnosprawnych', en: 'Wheelchair accessible' },
    air_conditioning: { pl: 'Klimatyzacja', en: 'Air conditioning' },
    airport_shuttle: { pl: 'Transfer lotniskowy', en: 'Airport shuttle' },
    babysitting: { pl: 'Opieka nad dziećmi', en: 'Babysitting' },
    balcony: { pl: 'Balkon', en: 'Balcony' },
    bar: { pl: 'Bar', en: 'Bar' },
    bbq: { pl: 'Grill', en: 'BBQ facilities' },
    beach_access: { pl: 'Dostęp do plaży', en: 'Beach access' },
    beachfront: { pl: 'Przy plaży', en: 'Beachfront' },
    breakfast: { pl: 'Śniadanie w cenie', en: 'Breakfast included' },
    buffet: { pl: 'Śniadanie bufet', en: 'Breakfast buffet' },
    car_rental: { pl: 'Wynajem aut', en: 'Car rental' },
    coffee_maker: { pl: 'Ekspres do kawy', en: 'Coffee maker' },
    coffee_shop: { pl: 'Kawiarnia', en: 'Coffee shop' },
    concierge: { pl: 'Concierge', en: 'Concierge' },
    daily_housekeeping: { pl: 'Codzienne sprzątanie', en: 'Daily housekeeping' },
    electric_bike: { pl: 'Rower elektryczny', en: 'Electric bike' },
    elevator: { pl: 'Winda', en: 'Elevator' },
    family_rooms: { pl: 'Pokoje rodzinne', en: 'Family rooms' },
    garden: { pl: 'Ogród', en: 'Garden' },
    gym: { pl: 'Siłownia', en: 'Fitness center' },
    hairdryer: { pl: 'Suszarka', en: 'Hairdryer' },
    hot_tub: { pl: 'Jacuzzi', en: 'Hot tub / Jacuzzi' },
    iron: { pl: 'Żelazko', en: 'Iron' },
    kids_club: { pl: 'Klub dziecięcy', en: 'Kids club' },
    kitchen: { pl: 'Kuchnia / Aneks', en: 'Kitchen / Kitchenette' },
    laundry: { pl: 'Pralnia', en: 'Laundry service' },
    luggage_storage: { pl: 'Przechowalnia bagażu', en: 'Luggage storage' },
    massage: { pl: 'Masaż', en: 'Massage' },
    minibar: { pl: 'Minibar', en: 'Mini-bar' },
    mountain_view: { pl: 'Widok na góry', en: 'Mountain view' },
    non_smoking: { pl: 'Dla niepalących', en: 'Non-smoking rooms' },
    parking: { pl: 'Darmowy parking', en: 'Free parking' },
    pets_allowed: { pl: 'Zwierzęta dozwolone', en: 'Pets allowed' },
    playground: { pl: 'Plac zabaw', en: 'Playground' },
    pool: { pl: 'Basen', en: 'Swimming pool' },
    private_bathroom: { pl: 'Prywatna łazienka', en: 'Private bathroom' },
    reception_24h: { pl: 'Recepcja 24h', en: '24h reception' },
    restaurant: { pl: 'Restauracja', en: 'Restaurant' },
    room_service: { pl: 'Obsługa pokoju', en: 'Room service' },
    safe: { pl: 'Sejf', en: 'In-room safe' },
    sauna: { pl: 'Sauna', en: 'Sauna' },
    sea_view: { pl: 'Widok na morze', en: 'Sea view' },
    spa: { pl: 'Spa', en: 'Spa' },
    tennis: { pl: 'Kort tenisowy', en: 'Tennis court' },
    terrace: { pl: 'Taras', en: 'Terrace' },
    tv: { pl: 'Telewizor', en: 'Flat-screen TV' },
    wifi: { pl: 'Darmowe WiFi', en: 'Free WiFi' },
  };

  function dedupeUrls(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((entry) => {
      const url = String(entry || '').trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push(url);
    });
    return out;
  }

  function getRoomGalleryUrls(roomType) {
    if (!roomType || typeof roomType !== 'object') return [];
    return dedupeUrls([
      roomType.cover_image_url,
      ...(Array.isArray(roomType.gallery_photos) ? roomType.gallery_photos : []),
      ...(Array.isArray(roomType.photos) ? roomType.photos : []),
    ]);
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

  function humanizeAmenityCode(code) {
    return String(code || '')
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  async function ensureAmenitiesCatalog() {
    if (hotelAmenitiesCatalog && Object.keys(hotelAmenitiesCatalog).length) {
      return hotelAmenitiesCatalog;
    }
    if (hotelAmenitiesLoadPromise) {
      return hotelAmenitiesLoadPromise;
    }

    hotelAmenitiesLoadPromise = (async () => {
      try {
        const module = await import('/js/supabaseClient.js');
        const supabase = module?.supabase;
        if (!supabase) {
          return hotelAmenitiesCatalog;
        }
        const { data, error } = await supabase
          .from('hotel_amenities')
          .select('code, icon, name_en, name_pl, is_popular')
          .eq('is_active', true);
        if (error) throw error;

        hotelAmenitiesCatalog = {};
        (Array.isArray(data) ? data : []).forEach((item) => {
          const code = String(item?.code || '').trim();
          if (!code) return;
          hotelAmenitiesCatalog[code] = item;
        });
      } catch (error) {
        console.warn('Failed to load hotel amenities catalog:', error);
      } finally {
        hotelAmenitiesLoadPromise = null;
      }
      return hotelAmenitiesCatalog;
    })();

    return hotelAmenitiesLoadPromise;
  }

  function getAmenityViewModel(code, language, catalog) {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) return null;
    const item = catalog && typeof catalog === 'object'
      ? catalog[normalizedCode]
      : null;
    const fallbackLabel = HOTEL_AMENITY_FALLBACK_LABELS[normalizedCode] || null;
    const icon = String(item?.icon || '•').trim() || '•';
    const name = String(
      language && language.startsWith('en')
        ? (item?.name_en || fallbackLabel?.en || item?.name_pl || fallbackLabel?.pl || humanizeAmenityCode(normalizedCode))
        : (item?.name_pl || fallbackLabel?.pl || item?.name_en || fallbackLabel?.en || humanizeAmenityCode(normalizedCode))
    ).trim();
    return {
      code: normalizedCode,
      icon,
      name: name || humanizeAmenityCode(normalizedCode),
      isPopular: Boolean(item?.is_popular),
    };
  }

  function renderAmenitiesChips(container, hotel, options) {
    const target = container instanceof Element ? container : null;
    if (!target) return false;

    const language = String(options?.language || getLanguage()).toLowerCase();
    const limit = Number(options?.limit);
    const preserveOrder = options?.preserveOrder !== false;
    const catalog = options?.catalog && typeof options.catalog === 'object'
      ? options.catalog
      : hotelAmenitiesCatalog;
    const amenities = Array.from(new Set(
      (Array.isArray(hotel?.amenities) ? hotel.amenities : [])
        .map((code) => String(code || '').trim())
        .filter(Boolean)
    ));

    if (!amenities.length) {
      target.hidden = true;
      target.innerHTML = '';
      return false;
    }

    let items = amenities
      .map((code) => getAmenityViewModel(code, language, catalog))
      .filter(Boolean);

    if (!preserveOrder) {
      items = items.slice().sort((a, b) => {
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        return a.name.localeCompare(b.name, language);
      });
    }

    if (Number.isFinite(limit) && limit > 0) {
      items = items.slice(0, limit);
    }

    if (!items.length) {
      target.hidden = true;
      target.innerHTML = '';
      return false;
    }

    target.hidden = false;
    if (!target.classList.contains('hotel-amenities-chips')) {
      target.classList.add('hotel-amenities-chips');
    }
    target.innerHTML = items.map((item) => `
      <span class="amenity-chip" data-amenity-code="${escapeAttribute(item.code)}">
        <span aria-hidden="true">${escapeHtml(item.icon)}</span>
        <span>${escapeHtml(item.name)}</span>
      </span>
    `).join('');
    return true;
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

  function buildHotelMapsHref(location) {
    const direct = String(location?.google_maps_url || '').trim();
    if (direct) return direct;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;
    }
    const summary = String(location?.summary || '').trim();
    if (summary) {
      return `https://www.google.com/maps?q=${encodeURIComponent(summary)}`;
    }
    return '';
  }

  function buildHotelAddressSummary(location) {
    const parts = [
      location?.address_line,
      location?.district,
      location?.postal_code,
      location?.city,
      location?.country,
    ].map((value) => String(value || '').trim()).filter(Boolean);
    if (parts.length) {
      return parts.join(', ');
    }
    return String(location?.summary || '').trim();
  }

  function ensureHotelLeafletStylesheet() {
    const doc = globalScope.document;
    if (!doc) return;
    if (doc.querySelector(`link[data-ce-hotel-leaflet-css="1"]`) || doc.querySelector(`link[href*="leaflet@1.9.4/dist/leaflet.css"]`)) {
      return;
    }
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = HOTEL_LEAFLET_CSS_URL;
    link.crossOrigin = '';
    link.setAttribute('data-ce-hotel-leaflet-css', '1');
    doc.head?.appendChild(link);
  }

  function loadLeafletLibrary() {
    if (globalScope.L && typeof globalScope.L.map === 'function') {
      return Promise.resolve(globalScope.L);
    }
    if (hotelLeafletLoadPromise) {
      return hotelLeafletLoadPromise;
    }

    const doc = globalScope.document;
    if (!doc) {
      return Promise.reject(new Error('Document unavailable'));
    }

    ensureHotelLeafletStylesheet();

    hotelLeafletLoadPromise = new Promise((resolve, reject) => {
      if (globalScope.L && typeof globalScope.L.map === 'function') {
        resolve(globalScope.L);
        return;
      }

      const onReady = () => {
        if (globalScope.L && typeof globalScope.L.map === 'function') {
          resolve(globalScope.L);
          return true;
        }
        return false;
      };
      if (onReady()) return;

      const existingScript = doc.querySelector('script[data-ce-hotel-leaflet-js="1"], script[src*="leaflet@1.9.4/dist/leaflet.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (!onReady()) reject(new Error('Leaflet failed to initialize'));
        }, { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Leaflet failed to load')), { once: true });
        return;
      }

      const script = doc.createElement('script');
      script.src = HOTEL_LEAFLET_JS_URL;
      script.crossOrigin = '';
      script.defer = true;
      script.setAttribute('data-ce-hotel-leaflet-js', '1');
      script.addEventListener('load', () => {
        if (!onReady()) reject(new Error('Leaflet failed to initialize'));
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('Leaflet failed to load')), { once: true });
      doc.head?.appendChild(script);
    }).catch((error) => {
      hotelLeafletLoadPromise = null;
      throw error;
    });

    return hotelLeafletLoadPromise;
  }

  function destroyLocationSummaryMap(container) {
    const target = container instanceof Element ? container : null;
    if (!target) return;
    const existing = hotelLocationMapState.get(target);
    if (existing?.map && typeof existing.map.remove === 'function') {
      try {
        existing.map.remove();
      } catch (_) {}
    }
    hotelLocationMapState.delete(target);
  }

  function scheduleLocationSummaryMapResize(map) {
    if (!map || typeof map.invalidateSize !== 'function') return;
    [0, 120, 320, 640].forEach((delay) => {
      globalScope.setTimeout(() => {
        try {
          map.invalidateSize(false);
        } catch (_) {}
      }, delay);
    });
  }

  function createLocationSummaryMap(target, hotel, location, signature, mapDomId) {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    loadLeafletLibrary()
      .then((L) => {
        const state = hotelLocationMapState.get(target);
        if (!state || state.signature !== signature) return;
        const mapNode = target.querySelector(`[data-hotel-location-map-id="${mapDomId}"]`);
        if (!(mapNode instanceof Element)) return;
        if (state.map) {
          scheduleLocationSummaryMapResize(state.map);
          return;
        }

        const map = L.map(mapNode, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: true,
          doubleClickZoom: true,
          boxZoom: false,
          keyboard: false,
          tap: true,
        }).setView([latitude, longitude], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const markerIcon = L.divIcon({
          className: 'ce-hotel-location-pin',
          html: '<span class="ce-hotel-location-pin__emoji" aria-hidden="true">🏨</span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });

        const marker = L.marker([latitude, longitude], { icon: markerIcon }).addTo(map);
        const title = localizeText(hotel?.title, getLanguage()) || hotel?.slug || 'Hotel';
        const address = buildHotelAddressSummary(location);
        marker.bindTooltip(
          `${escapeHtml(title)}${address ? `<br><span>${escapeHtml(address)}</span>` : ''}`,
          { direction: 'top', offset: [0, -10], opacity: 0.92 }
        );

        hotelLocationMapState.set(target, {
          signature,
          map,
          mapDomId,
        });
        scheduleLocationSummaryMapResize(map);
      })
      .catch((error) => {
        console.warn('Hotel location map failed to load:', error);
      });
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
    const roomGalleryUrls = getRoomGalleryUrls(selection.roomType);
    return {
      selection,
      roomTypeName,
      roomSummary,
      ratePlanName,
      ratePlanSummary,
      depositNote,
      cancellationText,
      roomGalleryUrls,
      roomInventoryUnits: selection.roomType?.inventory_units || null,
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
    const hasCoords = Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
    const mapsUrl = buildHotelMapsHref(location);
    const addressSummary = buildHotelAddressSummary(location);
    if (!addressSummary && !mapsUrl && !hasCoords) {
      destroyLocationSummaryMap(target);
      target.hidden = true;
      target.innerHTML = '';
      return false;
    }

    const title = language.startsWith('en') ? 'Location' : 'Lokalizacja';
    const addressLabel = language.startsWith('en') ? 'Address' : 'Adres';
    const mapLabel = language.startsWith('en') ? 'Google Maps' : 'Google Maps';
    const mapFallback = language.startsWith('en')
      ? 'Map preview appears after the hotel coordinates are added.'
      : 'Podgląd mapy pojawi się po uzupełnieniu współrzędnych hotelu.';
    const signature = [
      String(hotel?.id || hotel?.slug || ''),
      language,
      addressSummary,
      String(location.latitude ?? ''),
      String(location.longitude ?? ''),
      mapsUrl,
    ].join('|');

    const existing = hotelLocationMapState.get(target);
    if (existing?.signature === signature && target.innerHTML.trim()) {
      target.hidden = false;
      if (existing.map) {
        scheduleLocationSummaryMapResize(existing.map);
      }
      return true;
    }

    destroyLocationSummaryMap(target);
    const mapDomId = hasCoords ? `ce-hotel-location-map-${++hotelLocationMapCounter}` : '';

    target.hidden = false;
    target.innerHTML = `
      <div class="hotel-location-card">
        <div class="hotel-location-card__copy">
          <strong class="hotel-location-card__eyebrow">${escapeHtml(title)}</strong>
          ${addressSummary ? `
            <div class="hotel-location-card__address-block">
              <span class="hotel-location-card__address-label">${escapeHtml(addressLabel)}</span>
              <span class="hotel-location-card__address-value">${escapeHtml(addressSummary)}</span>
            </div>
          ` : ''}
        </div>
        <div class="hotel-location-card__map-shell">
          ${hasCoords ? `
            <div
              class="hotel-location-card__map"
              id="${mapDomId}"
              data-hotel-location-map
              data-hotel-location-map-id="${mapDomId}"
              aria-label="${escapeAttribute(addressSummary || title)}"
            ></div>
          ` : `
            <div class="hotel-location-card__map hotel-location-card__map--placeholder">
              <span>${escapeHtml(mapFallback)}</span>
            </div>
          `}
          ${mapsUrl ? `
            <a
              class="hotel-location-card__map-cta"
              href="${escapeAttribute(mapsUrl)}"
              target="_blank"
              rel="noopener"
            >
              ${escapeHtml(mapLabel)} ↗
            </a>
          ` : ''}
        </div>
      </div>
    `;
    hotelLocationMapState.set(target, { signature, map: null, mapDomId });
    if (hasCoords) {
      createLocationSummaryMap(target, hotel, location, signature, mapDomId);
    }
    return true;
  }

  function refreshLocationSummaryMap(container) {
    const target = container instanceof Element ? container : null;
    if (!target) return false;
    const state = hotelLocationMapState.get(target);
    if (state?.map) {
      scheduleLocationSummaryMapResize(state.map);
      return true;
    }
    return false;
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
    const galleryLabel = language.startsWith('en') ? 'Room gallery' : 'Galeria pokoju';
    const previewPrice = api?.getHotelMinPricePerNight
      ? api.getHotelMinPricePerNight(hotel, {
        preferredPersons: Math.min(Number(roomType.max_persons || 2) || 2, 2),
        selectedRoomTypeId: roomType.id,
        selectedRatePlanId: ratePlan?.id || '',
      })
      : null;
    const roomGalleryUrls = Array.isArray(summary.roomGalleryUrls) ? summary.roomGalleryUrls : [];
    const initialGalleryImage = roomGalleryUrls[0] || '';

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
          ${roomGalleryUrls.length ? `
          <div style="display:grid; gap:10px; margin-top:6px;">
            <strong style="font-size:12px; color:#475569;">${galleryLabel}</strong>
            <img
              src="${escapeAttribute(initialGalleryImage)}"
              alt="${escapeAttribute(summary.roomTypeName || galleryLabel)}"
              data-room-gallery-main
              style="width:100%; max-width:420px; aspect-ratio:16/10; object-fit:cover; border-radius:14px; border:1px solid rgba(148,163,184,.24); background:#fff;"
            />
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${roomGalleryUrls.map((url, index) => `
                <button
                  type="button"
                  data-room-gallery-thumb
                  data-room-gallery-src="${escapeAttribute(url)}"
                  style="padding:0; border:${index === 0 ? '2px solid #2563eb' : '1px solid rgba(148,163,184,.28)'}; background:#fff; border-radius:10px; overflow:hidden; cursor:pointer;"
                >
                  <img
                    src="${escapeAttribute(url)}"
                    alt="${escapeAttribute(`${summary.roomTypeName || galleryLabel} ${index + 1}`)}"
                    style="width:72px; height:72px; object-fit:cover; display:block;"
                  />
                </button>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    const roomSelect = target.querySelector(`select[name="${roomInputName}"]`);
    const ratePlanSelect = target.querySelector(`select[name="${ratePlanInputName}"]`);
    const galleryMain = target.querySelector('[data-room-gallery-main]');
    const galleryThumbs = Array.from(target.querySelectorAll('[data-room-gallery-thumb]'));

    galleryThumbs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = String(btn.getAttribute('data-room-gallery-src') || '').trim();
        if (!src || !(galleryMain instanceof HTMLImageElement)) return;
        galleryMain.src = src;
        galleryThumbs.forEach((thumb) => {
          thumb.style.border = thumb === btn
            ? '2px solid #2563eb'
            : '1px solid rgba(148,163,184,.28)';
        });
      });
    });

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
        room_inventory_units: selection.roomType?.inventory_units || null,
        room_cover_image_url: selection.roomType?.cover_image_url || null,
        room_gallery_photos: getRoomGalleryUrls(selection.roomType),
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
    ensureAmenitiesCatalog,
    renderAmenitiesChips,
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
    refreshLocationSummaryMap,
    renderRoomTypeOptions,
    renderPolicySummary,
    renderExtraOptions,
    buildBookingSnapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
