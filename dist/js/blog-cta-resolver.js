function normalizeLanguage(value) {
  return String(value || '').trim().toLowerCase() === 'pl' ? 'pl' : 'en';
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

const CTA_TYPE_ALIASES = {
  trips: ['trip', 'trips', 'tour', 'tours', 'wycieczka', 'wycieczki'],
  hotels: ['hotel', 'hotels', 'stay', 'stays', 'accommodation', 'accommodations', 'nocleg', 'noclegi'],
  cars: ['car', 'cars', 'car_offer', 'car_offers', 'car-rental', 'car_rental', 'auto', 'auta'],
  pois: ['poi', 'pois', 'place', 'places', 'attraction', 'attractions', 'miejsce', 'miejsca'],
  recommendations: [
    'recommendation',
    'recommendations',
    'recommended',
    'restaurant',
    'restaurants',
    'restauracja',
    'restauracje',
  ],
};

function normalizeServiceType(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (!raw) return '';
  if (CTA_TYPE_ALIASES[raw]) return raw;
  for (const [canonical, aliases] of Object.entries(CTA_TYPE_ALIASES)) {
    if (aliases.includes(raw)) {
      return canonical;
    }
  }
  return '';
}

function normalizeCtaServices(ctaServices) {
  return safeArray(ctaServices)
    .map((entry) => ({
      type: normalizeServiceType(entry?.type),
      resourceId: String(entry?.resource_id || entry?.resourceId || '').trim(),
    }))
    .filter((entry) => entry.type && entry.resourceId)
    .slice(0, 3);
}

function pickLocalizedObjectField(source, language) {
  if (typeof source === 'string') {
    return source;
  }
  if (!source || typeof source !== 'object') {
    return '';
  }
  return String(
    source[language]
    || source.en
    || source.pl
    || Object.values(source).find((entry) => typeof entry === 'string')
    || ''
  ).trim();
}

function pickMedia(source) {
  if (!source || typeof source !== 'object') {
    return '/assets/cyprus_logo-1000x1054.png';
  }
  const candidates = [
    source.cover_image_url,
    source.image_url,
    source.main_image_url,
    source.thumbnail_url,
    ...(Array.isArray(source.photos) ? source.photos : []),
  ];
  return String(candidates.find((entry) => String(entry || '').trim()) || '/assets/cyprus_logo-1000x1054.png').trim();
}

function truncateText(value, maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function buildCarHref(row, language) {
  const location = String(row?.location || '').trim().toLowerCase();
  if (location === 'paphos') {
    return `/autopfo.html?lang=${language}`;
  }
  if (location === 'larnaca') {
    return `/car-rental.html?lang=${language}`;
  }
  return `/car.html?lang=${language}`;
}

function buildServiceMeta(type, language) {
  const localized = normalizeLanguage(language);
  const copy = {
    en: {
      trips: { label: 'Trip', cta: 'Check trip' },
      hotels: { label: 'Stay', cta: 'Check stay' },
      cars: { label: 'Car rental', cta: 'Check cars' },
      pois: { label: 'Place', cta: 'Explore place' },
      recommendations: { label: 'Recommendation', cta: 'View recommendation' },
    },
    pl: {
      trips: { label: 'Wycieczka', cta: 'Sprawdź wycieczkę' },
      hotels: { label: 'Nocleg', cta: 'Sprawdź nocleg' },
      cars: { label: 'Auto', cta: 'Sprawdź auta' },
      pois: { label: 'Miejsce', cta: 'Poznaj miejsce' },
      recommendations: { label: 'Polecane', cta: 'Zobacz polecenie' },
    },
  };
  return copy[localized][type] || copy[localized].recommendations;
}

function mapTrip(row, language) {
  const meta = buildServiceMeta('trips', language);
  const title = pickLocalizedObjectField(row?.title, language) || String(row?.slug || 'Trip').trim();
  const description = truncateText(
    pickLocalizedObjectField(row?.description, language)
    || String(row?.start_city || '').trim()
  );
  const slug = String(row?.slug || '').trim();
  return {
    id: row?.id || null,
    type: 'trips',
    title,
    description,
    imageUrl: pickMedia(row),
    href: slug ? `/trip.html?slug=${encodeURIComponent(slug)}&lang=${language}` : `/trips.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.start_city || '').trim(),
  };
}

function mapHotel(row, language) {
  const meta = buildServiceMeta('hotels', language);
  const title = pickLocalizedObjectField(row?.title, language) || String(row?.slug || 'Hotel').trim();
  const description = truncateText(
    pickLocalizedObjectField(row?.description, language)
    || String(row?.city || '').trim()
  );
  const slug = String(row?.slug || '').trim();
  return {
    id: row?.id || null,
    type: 'hotels',
    title,
    description,
    imageUrl: pickMedia(row),
    href: slug ? `/hotel.html?slug=${encodeURIComponent(slug)}&lang=${language}` : `/hotels.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.city || '').trim(),
  };
}

function mapCar(row, language) {
  const meta = buildServiceMeta('cars', language);
  const title = pickLocalizedObjectField(row?.car_model, language) || pickLocalizedObjectField(row?.car_type, language) || 'Car rental';
  const price = Number(row?.price_per_day || row?.price_10plus_days || row?.price_7_10days || row?.price_4_6days || 0);
  return {
    id: row?.id || null,
    type: 'cars',
    title,
    description: truncateText(pickLocalizedObjectField(row?.description, language) || ''),
    imageUrl: pickMedia(row),
    href: buildCarHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: price > 0 ? `${price.toFixed(2)} €` : String(row?.location || '').trim(),
  };
}

function mapPoi(row, language) {
  const meta = buildServiceMeta('pois', language);
  const title = String(
    language === 'pl'
      ? row?.name_pl || row?.name_en || row?.slug || 'Place'
      : row?.name_en || row?.name_pl || row?.slug || 'Place'
  ).trim();
  const description = truncateText(
    language === 'pl'
      ? row?.description_pl || row?.description_en || ''
      : row?.description_en || row?.description_pl || ''
  );
  return {
    id: row?.id || null,
    type: 'pois',
    title,
    description,
    imageUrl: pickMedia(row),
    href: row?.id ? `/community.html?poi=${encodeURIComponent(String(row.id))}&lang=${language}` : `/community.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.city || row?.location_name || '').trim(),
  };
}

function mapRecommendation(row, language) {
  const meta = buildServiceMeta('recommendations', language);
  const title = String(
    language === 'pl'
      ? row?.title_pl || row?.title_en || 'Recommendation'
      : row?.title_en || row?.title_pl || 'Recommendation'
  ).trim();
  const description = truncateText(
    language === 'pl'
      ? row?.description_pl || row?.description_en || ''
      : row?.description_en || row?.description_pl || ''
  );
  return {
    id: row?.id || null,
    type: 'recommendations',
    title,
    description,
    imageUrl: pickMedia(row),
    href: `/recommendations.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.location_name || '').trim(),
  };
}

async function fetchRowsByIds(supabase, table, ids, select) {
  if (!supabase || !ids.length) return [];
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .in('id', ids);

  if (error) {
    console.warn(`[blog-cta] Failed to load ${table}:`, error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function resolveBlogCtaServices(supabase, ctaServices = [], language = 'en') {
  const localized = normalizeLanguage(language);
  const normalized = normalizeCtaServices(ctaServices);
  if (!normalized.length) {
    return [];
  }

  const idsByType = normalized.reduce((accumulator, entry) => {
    if (!accumulator[entry.type]) {
      accumulator[entry.type] = [];
    }
    accumulator[entry.type].push(entry.resourceId);
    return accumulator;
  }, {});

  const [trips, hotels, cars, pois, recommendations] = await Promise.all([
    fetchRowsByIds(supabase, 'trips', idsByType.trips || [], 'id, slug, title, description, cover_image_url, photos, price_base, price_per_person, pricing_model, start_city'),
    fetchRowsByIds(supabase, 'hotels', idsByType.hotels || [], 'id, slug, title, description, city, cover_image_url, photos'),
    fetchRowsByIds(supabase, 'car_offers', idsByType.cars || [], 'id, car_model, car_type, description, location, image_url, price_per_day, price_10plus_days, price_7_10days, price_4_6days'),
    fetchRowsByIds(supabase, 'pois', idsByType.pois || [], 'id, slug, name_pl, name_en, description_pl, description_en, main_image_url, photos, city, location_name'),
    fetchRowsByIds(supabase, 'recommendations', idsByType.recommendations || [], 'id, title_pl, title_en, description_pl, description_en, image_url, photos, location_name'),
  ]);

  const lookups = {
    trips: new Map(trips.map((row) => [String(row.id), row])),
    hotels: new Map(hotels.map((row) => [String(row.id), row])),
    cars: new Map(cars.map((row) => [String(row.id), row])),
    pois: new Map(pois.map((row) => [String(row.id), row])),
    recommendations: new Map(recommendations.map((row) => [String(row.id), row])),
  };

  return normalized
    .map((entry) => {
      const row = lookups[entry.type]?.get(entry.resourceId);
      if (!row) return null;
      switch (entry.type) {
        case 'trips':
          return mapTrip(row, localized);
        case 'hotels':
          return mapHotel(row, localized);
        case 'cars':
          return mapCar(row, localized);
        case 'pois':
          return mapPoi(row, localized);
        case 'recommendations':
          return mapRecommendation(row, localized);
        default:
          return null;
      }
    })
    .filter(Boolean);
}

export { normalizeLanguage as normalizeBlogUiLanguage };
