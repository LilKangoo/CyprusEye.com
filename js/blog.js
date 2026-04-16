import { supabase } from '/js/supabaseClient.js';
import { normalizeBlogUiLanguage } from '/js/blog-cta-resolver.js';

const BLOG_LIST_SELECT = `
  id,
  status,
  submission_status,
  published_at,
  cover_image_url,
  cover_image_alt,
  featured,
  allow_comments,
  categories,
  categories_pl,
  categories_en,
  tags,
  tags_pl,
  tags_en,
  cta_services,
  author_profile_id,
  owner_partner_id,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  created_at,
  updated_at,
  author_profile:profiles!blog_posts_author_profile_id_fkey (
    id,
    name,
    username,
    avatar_url
  ),
  translations:blog_post_translations (
    id,
    blog_post_id,
    lang,
    slug,
    title,
    meta_title,
    meta_description,
    summary,
    lead,
    author_name,
    author_url,
    og_image_url,
    created_at,
    updated_at
  )
`;

const BLOG_LIST_SELECT_LEGACY = `
  id,
  status,
  submission_status,
  published_at,
  cover_image_url,
  cover_image_alt,
  featured,
  allow_comments,
  categories,
  tags,
  cta_services,
  author_profile_id,
  owner_partner_id,
  reviewed_at,
  reviewed_by,
  rejection_reason,
  created_at,
  updated_at,
  author_profile:profiles!blog_posts_author_profile_id_fkey (
    id,
    name,
    username,
    avatar_url
  ),
  translations:blog_post_translations (
    id,
    blog_post_id,
    lang,
    slug,
    title,
    meta_title,
    meta_description,
    summary,
    lead,
    author_name,
    author_url,
    og_image_url,
    created_at,
    updated_at
  )
`;

const BLOG_PAGE_SIZE = Math.max(1, Number.parseInt(window.__BLOG_LIST__?.pageSize || '12', 10) || 12);

const COPY = {
  en: {
    heroEyebrow: 'CyprusEye Journal',
    heroTitle: 'Stories, guides and practical tips from Cyprus.',
    heroSubtitle: 'Curated blog posts in two languages, connected to the real services you can book in the app.',
    metricArticles: 'published articles',
    metricTopics: 'topics to explore',
    metricServices: 'linked services',
    metricLanguages: 'languages',
    featuredBadge: 'Featured story',
    featuredLink: 'Read article',
    readMore: 'Read article',
    loading: 'Loading articles...',
    empty: 'No blog posts are published yet.',
    filteredEmpty: 'No posts match this filter yet.',
    error: 'We could not load blog posts right now.',
    all: 'All posts',
    featured: 'Featured',
    tagged: 'Tag',
    category: 'Category',
    untitled: 'Untitled article',
    seoTitle: 'CyprusEye Blog | Cyprus travel guides, tips and ideas',
    seoDescription: 'Read CyprusEye guides, local tips and travel inspiration for Cyprus, with helpful links to trips, stays and services.',
    previous: 'Previous',
    next: 'Next',
    pageOf: 'Page {{current}} of {{total}}',
  },
  pl: {
    heroEyebrow: 'Dziennik CyprusEye',
    heroTitle: 'Historie, przewodniki i praktyczne wskazówki z Cypru.',
    heroSubtitle: 'Dwujęzyczny blog połączony z realnymi usługami, noclegami i wycieczkami dostępnymi w aplikacji.',
    metricArticles: 'opublikowanych artykułów',
    metricTopics: 'tematów do odkrycia',
    metricServices: 'podpiętych usług',
    metricLanguages: 'języki',
    featuredBadge: 'Wyróżniony artykuł',
    featuredLink: 'Czytaj artykuł',
    readMore: 'Czytaj dalej',
    loading: 'Ładowanie artykułów...',
    empty: 'Nie ma jeszcze opublikowanych wpisów blogowych.',
    filteredEmpty: 'Brak wpisów dla wybranego filtra.',
    error: 'Nie udało się teraz wczytać bloga.',
    all: 'Wszystkie wpisy',
    featured: 'Wyróżnione',
    tagged: 'Tag',
    category: 'Kategoria',
    untitled: 'Artykuł bez tytułu',
    seoTitle: 'Blog CyprusEye | Przewodniki, porady i inspiracje z Cypru',
    seoDescription: 'Czytaj przewodniki CyprusEye, lokalne porady i inspiracje z Cypru wraz z polecanymi usługami, noclegami i wycieczkami.',
    previous: 'Poprzednia',
    next: 'Następna',
    pageOf: 'Strona {{current}} z {{total}}',
  },
};

const state = {
  language: detectLanguage(),
  items: Array.isArray(window.__BLOG_LIST__?.items) ? window.__BLOG_LIST__.items.map(mapListRow) : [],
  loading: !Array.isArray(window.__BLOG_LIST__?.items),
  error: '',
  page: getInitialPage(),
  pageSize: BLOG_PAGE_SIZE,
  totalCount: Number.parseInt(window.__BLOG_LIST__?.totalCount || '0', 10) || 0,
  facets: {
    categories: [],
    tags: [],
    topics: [],
    featuredCount: 0,
  },
  activeFilter: getInitialFilter(),
  preload: window.__BLOG_LIST__ || null,
  taxonomySchemaMode: 'unknown',
};

function detectLanguage() {
  return normalizeBlogUiLanguage(
    new URLSearchParams(window.location.search).get('lang')
    || window.appI18n?.language
    || window.getCurrentLanguage?.()
    || document.documentElement.lang
    || 'en'
  );
}

function getInitialPage() {
  const params = new URLSearchParams(window.location.search);
  return Math.max(1, Number.parseInt(params.get('page') || window.__BLOG_LIST__?.page || '1', 10) || 1);
}

function getInitialFilter() {
  const params = new URLSearchParams(window.location.search);
  const category = String(params.get('category') || window.__BLOG_LIST__?.filter?.category || '').trim();
  const tag = String(params.get('tag') || window.__BLOG_LIST__?.filter?.tag || '').trim();
  const featured = String(params.get('featured') || (window.__BLOG_LIST__?.filter?.featured ? '1' : '')).trim() === '1';
  if (category) {
    return { kind: 'category', value: category };
  }
  if (tag) {
    return { kind: 'tag', value: tag };
  }
  if (featured) {
    return { kind: 'featured', value: 'featured' };
  }
  return { kind: 'all', value: 'all' };
}

function t(key, params = null) {
  let template = COPY[state.language]?.[key] || COPY.en[key] || '';
  if (!params || typeof template !== 'string') {
    return template;
  }
  Object.entries(params).forEach(([name, value]) => {
    template = template.replace(`{{${name}}}`, String(value));
  });
  return template;
}

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTaxonomyArray(value) {
  return safeArray(value).map((entry) => String(entry || '').trim()).filter(Boolean);
}

function isMissingTaxonomySchemaError(error) {
  const combined = [
    String(error?.code || ''),
    String(error?.message || ''),
    String(error?.details || ''),
    String(error?.hint || ''),
  ].join(' ').toLowerCase();
  return (
    combined.includes('42703')
    || combined.includes('does not exist')
    || combined.includes('could not find')
    || combined.includes('column')
  ) && /(categories_pl|categories_en|tags_pl|tags_en)/i.test(combined);
}

async function executeTaxonomyAwareQuery(primaryFactory, legacyFactory) {
  if (state.taxonomySchemaMode === 'legacy' && typeof legacyFactory === 'function') {
    return legacyFactory();
  }
  const primary = await primaryFactory();
  if (!primary?.error) {
    if (state.taxonomySchemaMode === 'unknown') {
      state.taxonomySchemaMode = 'localized';
    }
    return primary;
  }
  if (!isMissingTaxonomySchemaError(primary.error) || typeof legacyFactory !== 'function') {
    return primary;
  }
  state.taxonomySchemaMode = 'legacy';
  return legacyFactory();
}

async function ensureTaxonomySchemaMode() {
  if (state.taxonomySchemaMode !== 'unknown') {
    return state.taxonomySchemaMode;
  }

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .eq('submission_status', 'approved')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(1);

    if (!error && Array.isArray(data) && data[0]) {
      state.taxonomySchemaMode = Object.prototype.hasOwnProperty.call(data[0], 'categories_pl')
        ? 'localized'
        : 'legacy';
    }
  } catch (_error) {
    // keep unknown and let runtime fallback handle it
  }

  return state.taxonomySchemaMode;
}

function pickLocalizedText(value, language) {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  return String(
    value[language]
    || value.en
    || value.pl
    || Object.values(value).find((entry) => typeof entry === 'string')
    || ''
  ).trim();
}

function getTaxonomyByLang(source, kind) {
  const legacy = normalizeTaxonomyArray(source?.[kind]);
  const pl = normalizeTaxonomyArray(source?.[`${kind}_pl`] || source?.[`${kind}Pl`]);
  const en = normalizeTaxonomyArray(source?.[`${kind}_en`] || source?.[`${kind}En`]);
  return {
    pl: pl.length ? pl : legacy,
    en: en.length ? en : legacy,
  };
}

function mapTranslation(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id || null,
    blogPostId: row.blog_post_id || row.blogPostId || null,
    lang: normalizeBlogUiLanguage(row.lang),
    slug: String(row.slug || '').trim(),
    title: String(row.title || '').trim(),
    metaTitle: String(row.meta_title || row.metaTitle || '').trim(),
    metaDescription: String(row.meta_description || row.metaDescription || '').trim(),
    summary: String(row.summary || '').trim(),
    lead: String(row.lead || '').trim(),
    authorName: String(row.author_name || row.authorName || '').trim(),
    authorUrl: String(row.author_url || row.authorUrl || '').trim(),
    ogImageUrl: String(row.og_image_url || row.ogImageUrl || '').trim(),
  };
}

function buildTranslationsByLang(translations) {
  return safeArray(translations)
    .map(mapTranslation)
    .filter(Boolean)
    .reduce((accumulator, translation) => {
      accumulator[translation.lang] = translation;
      return accumulator;
    }, {});
}

function mapListRow(row) {
  if (row?.translationsByLang) {
    return {
      id: row.id || null,
      status: row.status || 'draft',
      submissionStatus: row.submissionStatus || row.submission_status || 'draft',
      publishedAt: row.publishedAt || row.published_at || null,
      coverImageUrl: String(row.coverImageUrl || row.cover_image_url || '').trim(),
      coverImageAlt: row.coverImageAlt || row.cover_image_alt || {},
      featured: Boolean(row.featured),
      allowComments: Boolean(row.allowComments || row.allow_comments),
      categories: normalizeTaxonomyArray(row.categories),
      categoriesByLang: row.categoriesByLang || getTaxonomyByLang(row, 'categories'),
      tags: normalizeTaxonomyArray(row.tags),
      tagsByLang: row.tagsByLang || getTaxonomyByLang(row, 'tags'),
      ctaServices: safeArray(row.ctaServices || row.cta_services),
      authorProfile: row.authorProfile || row.author_profile || null,
      translationsByLang: row.translationsByLang,
    };
  }

  const translationsByLang = buildTranslationsByLang(row.translations);
  return {
    id: row.id || null,
    status: row.status || 'draft',
    submissionStatus: row.submission_status || 'draft',
    publishedAt: row.published_at || null,
    coverImageUrl: String(row.cover_image_url || '').trim(),
    coverImageAlt: row.cover_image_alt || {},
    featured: Boolean(row.featured),
    allowComments: Boolean(row.allow_comments),
    categories: normalizeTaxonomyArray(row.categories),
    categoriesByLang: getTaxonomyByLang(row, 'categories'),
    tags: normalizeTaxonomyArray(row.tags),
    tagsByLang: getTaxonomyByLang(row, 'tags'),
    ctaServices: safeArray(row.cta_services),
    authorProfile: row.author_profile ? {
      id: row.author_profile.id || null,
      name: String(row.author_profile.name || '').trim(),
      username: String(row.author_profile.username || '').trim(),
      avatarUrl: String(row.author_profile.avatar_url || '').trim(),
    } : null,
    translationsByLang,
  };
}

function pickTranslation(post, language) {
  const byLang = post?.translationsByLang || {};
  return byLang[language] || byLang.en || byLang.pl || Object.values(byLang)[0] || null;
}

function resolveAuthor(post, language) {
  const translation = pickTranslation(post, language);
  const authorProfile = post?.authorProfile || null;
  const name = String(
    translation?.authorName
    || authorProfile?.name
    || authorProfile?.username
    || ''
  ).trim();
  if (!name) return null;
  return {
    name,
    url: String(translation?.authorUrl || '').trim(),
  };
}

function getLocalizedPost(post, language) {
  const translation = pickTranslation(post, language);
  const categoriesByLang = post?.categoriesByLang || getTaxonomyByLang(post, 'categories');
  const tagsByLang = post?.tagsByLang || getTaxonomyByLang(post, 'tags');
  return {
    ...post,
    translation,
    author: resolveAuthor(post, language),
    title: String(translation?.title || t('untitled')).trim(),
    summary: String(translation?.summary || '').trim(),
    lead: String(translation?.lead || '').trim(),
    metaTitle: String(translation?.metaTitle || '').trim(),
    metaDescription: String(translation?.metaDescription || '').trim(),
    slug: String(translation?.slug || '').trim(),
    categories: categoriesByLang[language] || categoriesByLang.en || categoriesByLang.pl || [],
    tags: tagsByLang[language] || tagsByLang.en || tagsByLang.pl || [],
    coverImageAlt: pickLocalizedText(post?.coverImageAlt, language) || String(translation?.title || t('untitled')).trim(),
  };
}

function buildTopicFacets(categories = [], tags = []) {
  const seen = new Map();
  categories.forEach((value) => {
    const normalizedKey = String(value || '').trim().toLowerCase();
    if (!normalizedKey || seen.has(normalizedKey)) return;
    seen.set(normalizedKey, { kind: 'category', value: String(value || '').trim() });
  });
  tags.forEach((value) => {
    const normalizedKey = String(value || '').trim().toLowerCase();
    if (!normalizedKey || seen.has(normalizedKey)) return;
    seen.set(normalizedKey, { kind: 'tag', value: String(value || '').trim() });
  });
  return Array.from(seen.values()).sort((left, right) => left.value.localeCompare(right.value, 'en', { sensitivity: 'base' }));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(state.language === 'pl' ? 'pl-PL' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function buildQueryState() {
  return {
    featured: state.activeFilter.kind === 'featured',
    category: state.activeFilter.kind === 'category' ? state.activeFilter.value : '',
    tag: state.activeFilter.kind === 'tag' ? state.activeFilter.value : '',
    page: state.page,
  };
}

function preloadMatchesRequest() {
  const preload = state.preload;
  if (!preload || !Array.isArray(preload.items)) return false;
  const preloadCount = Number.parseInt(preload.totalCount || '0', 10) || 0;
  if (preload.items.length === 0 && preloadCount === 0) {
    return false;
  }
  const query = buildQueryState();
  return (
    Number.parseInt(preload.page || '1', 10) === query.page
    && Boolean(preload.filter?.featured) === query.featured
    && String(preload.filter?.category || '') === query.category
    && String(preload.filter?.tag || '') === query.tag
  );
}

async function fetchBlogListPage() {
  const categoryColumn = state.language === 'pl' ? 'categories_pl' : 'categories_en';
  const tagColumn = state.language === 'pl' ? 'tags_pl' : 'tags_en';
  const from = (state.page - 1) * state.pageSize;
  const to = from + state.pageSize - 1;
  const buildQuery = (useLegacyTaxonomy = false) => {
    const activeCategoryColumn = useLegacyTaxonomy ? 'categories' : categoryColumn;
    const activeTagColumn = useLegacyTaxonomy ? 'tags' : tagColumn;
    let query = supabase
      .from('blog_posts')
      .select(useLegacyTaxonomy ? BLOG_LIST_SELECT_LEGACY : BLOG_LIST_SELECT, { count: 'exact' })
      .eq('status', 'published')
      .eq('submission_status', 'approved')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString());

    if (state.activeFilter.kind === 'featured') {
      query = query.eq('featured', true);
    } else if (state.activeFilter.kind === 'category') {
      query = query.contains(activeCategoryColumn, [state.activeFilter.value]);
    } else if (state.activeFilter.kind === 'tag') {
      query = query.contains(activeTagColumn, [state.activeFilter.value]);
    }

    return query
      .order('published_at', { ascending: false })
      .range(from, to);
  };

  const { data, error, count } = await executeTaxonomyAwareQuery(
    () => buildQuery(false),
    () => buildQuery(true)
  );

  if (error) {
    throw new Error(error.message || 'Failed to load blog list');
  }

  return {
    items: safeArray(data).map(mapListRow),
    totalCount: Number.isFinite(count) ? count : 0,
  };
}

async function fetchBlogFacets() {
  const categoryColumn = state.language === 'pl' ? 'categories_pl' : 'categories_en';
  const tagColumn = state.language === 'pl' ? 'tags_pl' : 'tags_en';
  const buildQuery = (useLegacyTaxonomy = false) => {
    const activeCategoryColumn = useLegacyTaxonomy ? 'categories' : categoryColumn;
    const activeTagColumn = useLegacyTaxonomy ? 'tags' : tagColumn;
    return supabase
      .from('blog_posts')
      .select(`${activeCategoryColumn}, ${activeTagColumn}, featured`)
      .eq('status', 'published')
      .eq('submission_status', 'approved')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .limit(500);
  };

  const { data, error } = await executeTaxonomyAwareQuery(
    () => buildQuery(false),
    () => buildQuery(true)
  );

  if (error) {
    throw new Error(error.message || 'Failed to load blog facets');
  }

  const categories = new Set();
  const tags = new Set();
  let featuredCount = 0;
  const useLegacyTaxonomy = safeArray(data).some((row) => !Object.prototype.hasOwnProperty.call(row || {}, categoryColumn));

  safeArray(data).forEach((row) => {
    if (row?.featured) {
      featuredCount += 1;
    }
    const categoryValues = useLegacyTaxonomy ? row?.categories : row?.[categoryColumn];
    const tagValues = useLegacyTaxonomy ? row?.tags : row?.[tagColumn];
    normalizeTaxonomyArray(categoryValues).forEach((entry) => {
      const value = String(entry || '').trim();
      if (value) categories.add(value);
    });
    normalizeTaxonomyArray(tagValues).forEach((entry) => {
      const value = String(entry || '').trim();
      if (value) tags.add(value);
    });
  });

  return {
    categories: Array.from(categories).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
    tags: Array.from(tags).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
    topics: buildTopicFacets(Array.from(categories), Array.from(tags)),
    featuredCount,
  };
}

function buildArticleUrl(post, language) {
  const translation = pickTranslation(post, language);
  const slug = String(translation?.slug || '').trim();
  if (!slug) {
    return language === 'pl' ? '/blog?lang=pl' : '/blog';
  }
  return language === 'pl'
    ? `/blog/${encodeURIComponent(slug)}?lang=pl`
    : `/blog/${encodeURIComponent(slug)}`;
}

function isFilterActive(filter) {
  return state.activeFilter.kind === filter.kind && state.activeFilter.value === filter.value;
}

function collectFilters() {
  const filters = [
    { kind: 'all', value: 'all' },
    { kind: 'featured', value: 'featured' },
    ...state.facets.topics.slice(0, 12),
  ];

  const hasActive = filters.some((filter) => filter.kind === state.activeFilter.kind && filter.value === state.activeFilter.value);
  if (!hasActive && state.activeFilter.kind !== 'all' && state.activeFilter.value) {
    filters.push({ ...state.activeFilter });
  }

  return filters;
}

function updateUrlState(push = false) {
  const url = new URL(window.location.href);
  if (state.language === 'pl') {
    url.searchParams.set('lang', 'pl');
  } else {
    url.searchParams.delete('lang');
  }

  if (state.page > 1) {
    url.searchParams.set('page', String(state.page));
  } else {
    url.searchParams.delete('page');
  }

  url.searchParams.delete('category');
  url.searchParams.delete('tag');
  url.searchParams.delete('featured');

  if (state.activeFilter.kind === 'category' && state.activeFilter.value) {
    url.searchParams.set('category', state.activeFilter.value);
  } else if (state.activeFilter.kind === 'tag' && state.activeFilter.value) {
    url.searchParams.set('tag', state.activeFilter.value);
  } else if (state.activeFilter.kind === 'featured') {
    url.searchParams.set('featured', '1');
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  if (push) {
    window.history.pushState({}, '', next);
  } else {
    window.history.replaceState({}, '', next);
  }
}

function updateListMeta() {
  document.title = t('seoTitle');
  const description = t('seoDescription');
  const descriptionNode = document.querySelector('meta[name="description"]');
  if (descriptionNode) descriptionNode.setAttribute('content', description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', t('seoTitle'));
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute('content', description);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', state.language === 'pl' ? `${window.location.origin}/blog?lang=pl` : `${window.location.origin}/blog`);
  const alternates = {
    pl: `${window.location.origin}/blog?lang=pl`,
    en: `${window.location.origin}/blog`,
    'x-default': `${window.location.origin}/blog`,
  };
  Object.entries(alternates).forEach(([code, url]) => {
    const node = document.querySelector(`link[rel="alternate"][hreflang="${code}"]`);
    if (node) node.setAttribute('href', url);
  });
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) {
    ogUrl.setAttribute('content', state.language === 'pl' ? `${window.location.origin}/blog?lang=pl` : `${window.location.origin}/blog`);
  }
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) {
    ogLocale.setAttribute('content', state.language === 'pl' ? 'pl_PL' : 'en_US');
  }
  const ogLocaleAlt = document.querySelector('meta[property="og:locale:alternate"]');
  if (ogLocaleAlt) {
    ogLocaleAlt.setAttribute('content', state.language === 'pl' ? 'en_US' : 'pl_PL');
  }
}

function renderStaticCopy() {
  $('#blogHeroEyebrow').textContent = t('heroEyebrow');
  $('#blogHeroTitle').textContent = t('heroTitle');
  $('#blogHeroSubtitle').textContent = t('heroSubtitle');
  $('#blogMetricCount').textContent = String(state.totalCount);
  $('#blogMetricCountLabel').textContent = t('metricArticles');
  $('#blogMetricTagCount').textContent = String(state.facets.topics.length);
  $('#blogMetricTagLabel').textContent = t('metricTopics');
  updateListMeta();
}

function renderFilters() {
  const container = $('#blogFilters');
  if (!container) return;
  container.innerHTML = collectFilters().map((filter) => {
    let label = t('all');
    if (filter.kind === 'featured') {
      label = t('featured');
    } else if (filter.kind === 'category' || filter.kind === 'tag') {
      label = filter.value;
    }

    return `<button class="blog-filter-chip${isFilterActive(filter) ? ' is-active' : ''}" type="button" data-filter-kind="${escapeHtml(filter.kind)}" data-filter-value="${escapeHtml(filter.value)}">${escapeHtml(label)}</button>`;
  }).join('');
}

function renderFeatured() {
  const featuredSection = $('#blogFeaturedSection');
  if (!featuredSection) return;

  const source = state.items.find((item) => item.featured) || state.items[0] || null;
  if (!source) {
    featuredSection.hidden = true;
    return;
  }

  const post = getLocalizedPost(source, state.language);
  $('#blogFeaturedImage').src = post.coverImageUrl || '/assets/cyprus_logo-1000x1054.png';
  $('#blogFeaturedImage').alt = post.coverImageAlt || post.title;
  $('#blogFeaturedBadge').textContent = source.featured ? t('featuredBadge') : t('featured');
  $('#blogFeaturedDate').textContent = formatDate(post.publishedAt);
  $('#blogFeaturedTitle').textContent = post.title;
  $('#blogFeaturedSummary').textContent = post.summary || post.lead || '';
  $('#blogFeaturedLink').href = buildArticleUrl(source, state.language);
  $('#blogFeaturedLinkLabel').textContent = t('featuredLink');
  featuredSection.hidden = false;
}

function renderGrid() {
  const grid = $('#blogGrid');
  const stateNode = $('#blogState');
  if (!grid || !stateNode) return;

  const localized = state.items.map((item) => getLocalizedPost(item, state.language));
  if (!localized.length) {
    grid.hidden = true;
    stateNode.hidden = false;
    stateNode.dataset.tone = '';
    stateNode.textContent = state.activeFilter.kind === 'all' ? t('empty') : t('filteredEmpty');
    return;
  }

  grid.innerHTML = localized.map((post) => {
    const author = post.author?.name ? `<p class="blog-card__author">${escapeHtml(post.author.name)}</p>` : '';
    return `
      <article class="blog-card">
        <img class="blog-card__image" src="${escapeHtml(post.coverImageUrl || '/assets/cyprus_logo-1000x1054.png')}" alt="${escapeHtml(post.coverImageAlt || post.title)}" loading="lazy" />
        <div class="blog-card__body">
          <div class="blog-meta-row">
            ${post.categories[0] ? `<span class="blog-meta-pill">${escapeHtml(post.categories[0])}</span>` : ''}
            <span>${escapeHtml(formatDate(post.publishedAt))}</span>
          </div>
          <h3 class="blog-card__title">${escapeHtml(post.title)}</h3>
          <p class="blog-card__summary">${escapeHtml(post.summary || post.lead || '')}</p>
          ${author}
          <div class="blog-card__footer">
            <a class="blog-card__link" href="${escapeHtml(buildArticleUrl(post, state.language))}">
              <span>${escapeHtml(t('readMore'))}</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  stateNode.hidden = true;
  grid.hidden = false;
}

function renderPagination() {
  const container = $('#blogPagination');
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
  if (totalPages <= 1) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const pages = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || Math.abs(page - state.page) <= 1) {
      pages.push(page);
    }
  }
  const uniquePages = Array.from(new Set(pages));

  container.innerHTML = `
    <button class="blog-pagination__nav" type="button" data-blog-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>${escapeHtml(t('previous'))}</button>
    <div class="blog-pagination__pages">
      ${uniquePages.map((page, index) => {
        const prev = uniquePages[index - 1];
        const gap = prev && page - prev > 1 ? '<span class="blog-pagination__gap">…</span>' : '';
        return `${gap}<button class="blog-pagination__page${page === state.page ? ' is-active' : ''}" type="button" data-blog-page="${page}" ${page === state.page ? 'aria-current="page"' : ''}>${page}</button>`;
      }).join('')}
    </div>
    <div class="blog-pagination__status">${escapeHtml(t('pageOf', { current: state.page, total: totalPages }))}</div>
    <button class="blog-pagination__nav" type="button" data-blog-page="${state.page + 1}" ${state.page >= totalPages ? 'disabled' : ''}>${escapeHtml(t('next'))}</button>
  `;
  container.hidden = false;
}

function render() {
  renderStaticCopy();
  renderFilters();
  renderFeatured();
  renderGrid();
  renderPagination();
}

async function ensureData(force = false) {
  const stateNode = $('#blogState');
  if (stateNode) {
    stateNode.hidden = false;
    stateNode.dataset.tone = '';
    stateNode.textContent = t('loading');
  }

  await ensureTaxonomySchemaMode();

  if (!state.facets.topics.length) {
    try {
      state.facets = await fetchBlogFacets();
    } catch (error) {
      console.warn('[blog] Failed to load blog facets:', error);
    }
  }

  try {
    if (!force && preloadMatchesRequest()) {
      state.items = safeArray(state.preload?.items).map(mapListRow);
      state.totalCount = Number.parseInt(state.preload?.totalCount || '0', 10) || state.items.length;
    } else {
      const result = await fetchBlogListPage();
      state.items = result.items;
      state.totalCount = result.totalCount;
    }
    state.error = '';
  } catch (error) {
    console.error('[blog] Failed to load articles:', error);
    if (state.items.length) {
      state.error = '';
    } else {
      state.error = error?.message || t('error');
    }
  } finally {
    state.loading = false;
  }

  if (state.error) {
    if (stateNode) {
      stateNode.hidden = false;
      stateNode.dataset.tone = 'error';
      stateNode.textContent = t('error');
    }
    $('#blogGrid')?.setAttribute('hidden', '');
    $('#blogPagination')?.setAttribute('hidden', '');
    renderStaticCopy();
    renderFilters();
    return;
  }

  render();
}

async function setFilter(nextFilter) {
  state.activeFilter = nextFilter;
  state.page = 1;
  updateUrlState(true);
  await ensureData(true);
}

async function setPage(nextPage) {
  const page = Math.max(1, Number.parseInt(nextPage || '1', 10) || 1);
  if (page === state.page) return;
  state.page = page;
  updateUrlState(true);
  await ensureData(true);
}

function bindEvents() {
  $('#blogFilters')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter-kind]');
    if (!(button instanceof HTMLElement)) return;
    void setFilter({
      kind: String(button.dataset.filterKind || 'all'),
      value: String(button.dataset.filterValue || 'all'),
    });
  });

  $('#blogPagination')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-blog-page]');
    if (!(button instanceof HTMLElement)) return;
    const nextPage = Number.parseInt(button.dataset.blogPage || '', 10);
    if (!Number.isFinite(nextPage) || nextPage < 1) return;
    void setPage(nextPage);
  });

  const handleLanguageChange = (language) => {
    state.language = normalizeBlogUiLanguage(language);
    updateUrlState();
    state.facets = {
      categories: [],
      tags: [],
      topics: [],
      featuredCount: 0,
    };
    void ensureData(true);
  };

  document.addEventListener('wakacjecypr:languagechange', (event) => {
    handleLanguageChange(event?.detail?.language);
  });

  window.addEventListener('languageChanged', (event) => {
    handleLanguageChange(event?.detail?.language);
  });

  window.addEventListener('popstate', () => {
    state.language = detectLanguage();
    state.page = getInitialPage();
    state.activeFilter = getInitialFilter();
    void ensureData(true);
  });

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler((language) => {
      handleLanguageChange(language);
    }, 0);
  }
}

bindEvents();
ensureData();
