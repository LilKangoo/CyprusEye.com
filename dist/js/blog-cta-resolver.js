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
  transport: ['transport', 'route', 'routes', 'transfer', 'transfers', 'ride', 'rides', 'przejazd', 'trasa'],
  shop: ['shop', 'store', 'product', 'products', 'sklep', 'produkt', 'produkty'],
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
  blog: ['blog', 'post', 'posts', 'article', 'articles', 'blog-post', 'blog_article', 'artykul', 'artykuly'],
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

function pickLocalizedPoiField(row, fieldBase, language) {
  const i18nValue = row?.[`${fieldBase}_i18n`];
  if (i18nValue && typeof i18nValue === 'object') {
    const localized = String(
      i18nValue[language]
      || i18nValue.en
      || i18nValue.pl
      || Object.values(i18nValue).find((entry) => typeof entry === 'string')
      || ''
    ).trim();
    if (localized) return localized;
  }

  const localizedLegacy = String(
    language === 'pl'
      ? row?.[`${fieldBase}_pl`] || row?.[`${fieldBase}_en`] || ''
      : row?.[`${fieldBase}_en`] || row?.[`${fieldBase}_pl`] || ''
  ).trim();
  if (localizedLegacy) return localizedLegacy;

  return String(row?.[fieldBase] || row?.title || row?.slug || '').trim();
}

function getPoiMetaLabel(row) {
  return String(
    row?.city
    || row?.location_name
    || row?.location
    || row?.region
    || row?.category
    || ''
  ).trim();
}

function pickMedia(source) {
  if (!source || typeof source !== 'object') {
    return '/assets/cyprus_logo-1000x1054.png';
  }
  const arrayMedia = [];
  const pushMedia = (entry) => {
    if (!entry) return;
    if (typeof entry === 'string') {
      const normalized = entry.trim();
      if (normalized) arrayMedia.push(normalized);
      return;
    }
    if (typeof entry === 'object') {
      pushMedia(entry.url || entry.src || entry.image_url || entry.photo_url);
    }
  };
  safeArray(source.photos).forEach(pushMedia);
  safeArray(source.images).forEach(pushMedia);
  const candidates = [
    source.cover_image_url,
    source.image_url,
    source.main_image_url,
    source.thumbnail_url,
    ...arrayMedia,
  ];
  return String(candidates.find((entry) => String(entry || '').trim()) || '/assets/cyprus_logo-1000x1054.png').trim();
}

function truncateText(value, maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function slugifyText(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCarReadableSlug(row) {
  const raw = pickLocalizedObjectField(row?.car_model, 'en')
    || pickLocalizedObjectField(row?.car_model, 'pl')
    || pickLocalizedObjectField(row?.car_type, 'en')
    || pickLocalizedObjectField(row?.car_type, 'pl')
    || String(row?.car_model || row?.car_type || '').trim();
  return slugifyText(raw || 'car-offer');
}

function buildCarHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  const offerLocation = String(row?.location || '').trim().toLowerCase();
  if (resourceId) {
    params.set('offer_id', resourceId);
    params.set('car', getCarReadableSlug(row));
  }
  if (offerLocation) {
    params.set('offer_location', offerLocation);
  }
  params.set('lang', normalizeLanguage(language));
  return `/car.html?${params.toString()}`;
}

function buildRecommendationHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  if (resourceId) {
    params.set('recommendation', resourceId);
  }
  params.set('lang', normalizeLanguage(language));
  return `/recommendations.html?${params.toString()}`;
}

function buildTransportHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  if (resourceId) {
    params.set('route_id', resourceId);
  }
  params.set('lang', normalizeLanguage(language));
  return `/transport.html?${params.toString()}`;
}

function buildShopHref(row, language) {
  const params = new URLSearchParams();
  const resourceId = String(row?.id || '').trim();
  if (resourceId) {
    params.set('product', resourceId);
  }
  params.set('lang', normalizeLanguage(language));
  return `/shop.html?${params.toString()}`;
}

function buildBlogHref(row, language) {
  const translations = safeArray(row?.translations);
  const preferred = translations.find((entry) => normalizeLanguage(entry?.lang) === normalizeLanguage(language)) || null;
  const fallback = translations.find((entry) => normalizeLanguage(entry?.lang) === 'en')
    || translations.find((entry) => normalizeLanguage(entry?.lang) === 'pl')
    || translations[0]
    || null;
  const slug = String(preferred?.slug || fallback?.slug || '').trim();
  if (!slug) {
    return `/blog?lang=${normalizeLanguage(language)}`;
  }
  return `/blog/${encodeURIComponent(slug)}?lang=${normalizeLanguage(language)}`;
}

function buildServiceMeta(type, language) {
  const localized = normalizeLanguage(language);
  const copy = {
    en: {
      trips: { label: 'Trip', cta: 'Check trip' },
      hotels: { label: 'Stay', cta: 'Check stay' },
      cars: { label: 'Car rental', cta: 'Check cars' },
      transport: { label: 'Transport', cta: 'Check route' },
      shop: { label: 'Product', cta: 'Check product' },
      pois: { label: 'Place', cta: 'Explore place' },
      recommendations: { label: 'Recommendation', cta: 'View recommendation' },
      blog: { label: 'Article', cta: 'Read article' },
    },
    pl: {
      trips: { label: 'Wycieczka', cta: 'Sprawdź wycieczkę' },
      hotels: { label: 'Nocleg', cta: 'Sprawdź nocleg' },
      cars: { label: 'Auto', cta: 'Sprawdź auta' },
      transport: { label: 'Transport', cta: 'Sprawdź trasę' },
      shop: { label: 'Produkt', cta: 'Zobacz produkt' },
      pois: { label: 'Miejsce', cta: 'Poznaj miejsce' },
      recommendations: { label: 'Polecane', cta: 'Zobacz polecenie' },
      blog: { label: 'Artykuł', cta: 'Czytaj artykuł' },
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
    resourceId: row?.id || null,
    language,
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
    resourceId: row?.id || null,
    language,
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
    resourceId: row?.id || null,
    offerLocation: String(row?.location || '').trim().toLowerCase(),
    language,
  };
}

function mapPoi(row, language) {
  const meta = buildServiceMeta('pois', language);
  const title = pickLocalizedPoiField(row, 'name', language) || 'Place';
  const description = truncateText(pickLocalizedPoiField(row, 'description', language) || '');
  return {
    id: row?.id || null,
    type: 'pois',
    title,
    description,
    imageUrl: pickMedia(row),
    href: row?.id ? `/community.html?poi=${encodeURIComponent(String(row.id))}&lang=${language}` : `/community.html?lang=${language}`,
    ctaLabel: meta.cta,
    label: meta.label,
    meta: getPoiMetaLabel(row),
    resourceId: row?.id || null,
    language,
  };
}

function formatMoney(value, currency = 'EUR') {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `${amount.toFixed(2)} ${String(currency || 'EUR').trim().toUpperCase() || 'EUR'}`;
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
    href: buildRecommendationHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: String(row?.location_name || '').trim(),
    resourceId: row?.id || null,
    language,
  };
}

function mapTransport(row, language) {
  const meta = buildServiceMeta('transport', language);
  const origin = row?.origin_location || null;
  const destination = row?.destination_location || null;
  const originLabel = String(origin?.name || origin?.name_local || origin?.code || 'Origin').trim();
  const destinationLabel = String(destination?.name || destination?.name_local || destination?.code || 'Destination').trim();
  const prices = [Number(row?.day_price || 0), Number(row?.night_price || 0)].filter((value) => Number.isFinite(value) && value > 0);
  const fromPrice = prices.length ? Math.min(...prices) : 0;
  const currency = String(row?.currency || 'EUR').trim().toUpperCase() || 'EUR';
  const capacityBits = [
    Number(row?.included_passengers || 0) > 0 ? `${row.included_passengers} pax` : '',
    Number(row?.included_bags || 0) > 0 ? `${row.included_bags} bags` : '',
  ].filter(Boolean);
  const title = `${originLabel} → ${destinationLabel}`;
  return {
    id: row?.id || null,
    type: 'transport',
    title,
    description: truncateText(capacityBits.join(' · ') || `${originLabel} → ${destinationLabel}`),
    imageUrl: pickMedia({}),
    href: buildTransportHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: fromPrice > 0 ? `from ${formatMoney(fromPrice, currency)}` : '',
    resourceId: row?.id || null,
    language,
  };
}

function mapShop(row, language) {
  const meta = buildServiceMeta('shop', language);
  const title = String(
    language === 'pl'
      ? row?.name || row?.name_en || row?.slug || 'Product'
      : row?.name_en || row?.name || row?.slug || 'Product'
  ).trim();
  const description = truncateText(
    language === 'pl'
      ? row?.short_description || row?.description || row?.short_description_en || row?.description_en || ''
      : row?.short_description_en || row?.description_en || row?.short_description || row?.description || ''
  );
  const category = row?.category || {};
  const categoryLabel = String(
    language === 'pl'
      ? category?.name || category?.name_en || ''
      : category?.name_en || category?.name || ''
  ).trim();
  const price = Number(row?.price || row?.sale_price || 0);
  return {
    id: row?.id || null,
    type: 'shop',
    title,
    description,
    imageUrl: pickMedia(row),
    href: buildShopHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: [categoryLabel, price > 0 ? formatMoney(price, 'EUR') : ''].filter(Boolean).join(' · '),
    resourceId: row?.id || null,
    language,
  };
}

function mapBlog(row, language) {
  const meta = buildServiceMeta('blog', language);
  const translations = safeArray(row?.translations);
  const preferred = translations.find((entry) => normalizeLanguage(entry?.lang) === normalizeLanguage(language)) || null;
  const fallback = translations.find((entry) => normalizeLanguage(entry?.lang) === 'en')
    || translations.find((entry) => normalizeLanguage(entry?.lang) === 'pl')
    || translations[0]
    || null;
  const title = String(preferred?.title || fallback?.title || 'Blog post').trim();
  const description = truncateText(preferred?.summary || preferred?.lead || fallback?.summary || fallback?.lead || '');
  const publishedAt = row?.published_at ? new Date(row.published_at) : null;
  const metaLabel = publishedAt && !Number.isNaN(publishedAt.getTime())
    ? new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(publishedAt)
    : '';
  return {
    id: row?.id || null,
    type: 'blog',
    title,
    description,
    imageUrl: pickMedia(row),
    href: buildBlogHref(row, language),
    ctaLabel: meta.cta,
    label: meta.label,
    meta: metaLabel,
    resourceId: row?.id || null,
    language,
  };
}

async function fetchRowsByIds(supabase, table, ids, select, filters = []) {
  if (!supabase || !ids.length) return [];
  let query = supabase
    .from(table)
    .select(select);

  for (const applyFilter of safeArray(filters)) {
    if (typeof applyFilter !== 'function') continue;
    query = applyFilter(query) || query;
  }

  const { data, error } = await query.in('id', ids);

  if (error && table === 'pois' && String(error?.message || '').toLowerCase().includes('status')) {
    const fallbackSelect = String(select || '').replace(/\s*,?\s*status\s*/i, '');
    const { data: fallbackData, error: fallbackError } = await supabase
      .from(table)
      .select(fallbackSelect)
      .in('id', ids);
    if (!fallbackError) {
      return Array.isArray(fallbackData) ? fallbackData : [];
    }
  }

  if (error) {
    console.warn(`[blog-cta] Failed to load ${table}:`, error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function fetchPoiRowsByIds(supabase, ids) {
  if (!supabase || !ids.length) return [];

  let { data, error } = await supabase
    .from('pois')
    .select('*')
    .eq('status', 'published')
    .in('id', ids);

  if (error && /status/i.test(String(error?.message || ''))) {
    ({ data, error } = await supabase
      .from('pois')
      .select('*')
      .in('id', ids));
  }

  if (error) {
    console.warn('[blog-cta] Failed to load pois:', error);
    return [];
  }

  return safeArray(data).filter((row) => String(row?.status || 'published').trim().toLowerCase() === 'published');
}

async function fetchTransportRowsByIds(supabase, ids) {
  if (!supabase || !ids.length) return [];
  const { data: routes, error: routeError } = await supabase
    .from('transport_routes')
    .select('id, origin_location_id, destination_location_id, day_price, night_price, currency, included_passengers, included_bags')
    .eq('is_active', true)
    .in('id', ids);

  if (routeError) {
    console.warn('[blog-cta] Failed to load transport_routes:', routeError);
    return [];
  }

  const locationIds = Array.from(new Set(
    safeArray(routes).flatMap((row) => [String(row?.origin_location_id || '').trim(), String(row?.destination_location_id || '').trim()]).filter(Boolean)
  ));
  let locationById = new Map();
  if (locationIds.length) {
    const { data: locations, error: locationError } = await supabase
      .from('transport_locations')
      .select('id, name, name_local, code')
      .eq('is_active', true)
      .in('id', locationIds);

    if (locationError) {
      console.warn('[blog-cta] Failed to load transport_locations:', locationError);
    } else {
      locationById = new Map(safeArray(locations).map((row) => [String(row?.id || '').trim(), row]));
    }
  }

  return safeArray(routes).map((row) => ({
    ...row,
    origin_location: locationById.get(String(row?.origin_location_id || '').trim()) || null,
    destination_location: locationById.get(String(row?.destination_location_id || '').trim()) || null,
  }));
}

async function fetchBlogRowsByIds(supabase, ids) {
  if (!supabase || !ids.length) return [];
  const { data, error } = await supabase
    .from('blog_posts')
    .select(`
      id,
      published_at,
      cover_image_url,
      translations:blog_post_translations (
        lang,
        slug,
        title,
        summary,
        lead
      )
    `)
    .eq('status', 'published')
    .eq('submission_status', 'approved')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .in('id', ids);

  if (error) {
    console.warn('[blog-cta] Failed to load blog_posts:', error);
    return [];
  }

  return safeArray(data);
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

  const [trips, hotels, cars, transport, shop, pois, recommendations, blog] = await Promise.all([
    fetchRowsByIds(
      supabase,
      'trips',
      idsByType.trips || [],
      'id, slug, title, description, cover_image_url, price_base, price_per_person, pricing_model, start_city',
      [(query) => query.eq('is_published', true)]
    ),
    fetchRowsByIds(
      supabase,
      'hotels',
      idsByType.hotels || [],
      'id, slug, title, description, city, cover_image_url, photos',
      [(query) => query.eq('is_published', true)]
    ),
    fetchRowsByIds(
      supabase,
      'car_offers',
      idsByType.cars || [],
      'id, car_model, car_type, description, location, image_url, price_per_day, price_10plus_days, price_7_10days, price_4_6days',
      [
        (query) => query.eq('is_published', true),
        (query) => query.eq('is_available', true),
      ]
    ),
    fetchTransportRowsByIds(supabase, idsByType.transport || []),
    fetchRowsByIds(
      supabase,
      'shop_products',
      idsByType.shop || [],
      'id, name, name_en, slug, short_description, short_description_en, description, description_en, thumbnail_url, images, price, sale_price, category_id, category:shop_categories(name, name_en, slug)',
      [(query) => query.eq('status', 'active')]
    ),
    fetchPoiRowsByIds(supabase, idsByType.pois || []),
    fetchRowsByIds(
      supabase,
      'recommendations',
      idsByType.recommendations || [],
      'id, title_pl, title_en, description_pl, description_en, image_url, images, location_name',
      [(query) => query.eq('active', true)]
    ),
    fetchBlogRowsByIds(supabase, idsByType.blog || []),
  ]);

  const lookups = {
    trips: new Map(trips.map((row) => [String(row.id), row])),
    hotels: new Map(hotels.map((row) => [String(row.id), row])),
    cars: new Map(cars.map((row) => [String(row.id), row])),
    transport: new Map(transport.map((row) => [String(row.id), row])),
    shop: new Map(shop.map((row) => [String(row.id), row])),
    pois: new Map(pois.map((row) => [String(row.id), row])),
    recommendations: new Map(recommendations.map((row) => [String(row.id), row])),
    blog: new Map(blog.map((row) => [String(row.id), row])),
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
        case 'transport':
          return mapTransport(row, localized);
        case 'shop':
          return mapShop(row, localized);
        case 'pois':
          return mapPoi(row, localized);
        case 'recommendations':
          return mapRecommendation(row, localized);
        case 'blog':
          return mapBlog(row, localized);
        default:
          return null;
      }
    })
    .filter(Boolean);
}

export { normalizeLanguage as normalizeBlogUiLanguage };
