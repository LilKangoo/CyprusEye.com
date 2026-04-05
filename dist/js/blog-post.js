import { supabase } from '/js/supabaseClient.js';
import { normalizeBlogUiLanguage, resolveBlogCtaServices } from '/js/blog-cta-resolver.js';

const POST_SELECT = `
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
  content_json,
  content_html,
  og_image_url,
  created_at,
  updated_at,
  blog_post:blog_posts (
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
    )
  )
`;

const POST_SELECT_LEGACY = `
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
  content_json,
  content_html,
  og_image_url,
  created_at,
  updated_at,
  blog_post:blog_posts (
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
    )
  )
`;

const SIBLING_TRANSLATIONS_SELECT = `
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
  content_html,
  og_image_url,
  created_at,
  updated_at
`;

const RELATED_POSTS_SELECT = `
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

const RELATED_POSTS_SELECT_LEGACY = `
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

const COPY = {
  en: {
    loading: 'Loading article...',
    missingSlug: 'This article link is incomplete.',
    notFound: 'We could not find this blog post.',
    error: 'The article could not be loaded right now.',
    kicker: 'CyprusEye story',
    byline: 'Written by',
    sidebarHeading: 'Quick overview',
    sidebarTags: 'Tags',
    ctaEyebrow: 'Continue with CyprusEye',
    ctaTitle: 'Useful services linked to this article.',
    relatedEyebrow: 'See also',
    relatedTitle: 'Related articles you may want to read next.',
    relatedLink: 'Read article',
    backToList: '← Back to blog list',
    untitled: 'Untitled article',
  },
  pl: {
    loading: 'Ładowanie artykułu...',
    missingSlug: 'Ten link do artykułu jest niekompletny.',
    notFound: 'Nie udało się znaleźć tego wpisu blogowego.',
    error: 'Artykuł nie może zostać teraz wczytany.',
    kicker: 'Artykuł CyprusEye',
    byline: 'Autor',
    sidebarHeading: 'Szybki przegląd',
    sidebarTags: 'Tagi',
    ctaEyebrow: 'Kontynuuj z CyprusEye',
    ctaTitle: 'Usługi powiązane z tym artykułem.',
    relatedEyebrow: 'Zobacz także',
    relatedTitle: 'Powiązane artykuły, które warto przeczytać dalej.',
    relatedLink: 'Czytaj artykuł',
    backToList: '← Powrót do listy blogów',
    untitled: 'Artykuł bez tytułu',
  },
};

const state = {
  language: detectLanguage(),
  post: window.__BLOG_POST__?.post || null,
  loading: !window.__BLOG_POST__?.post,
  error: '',
  slug: getInitialSlug(),
};

function detectLanguage() {
  return normalizeBlogUiLanguage(
    window.appI18n?.language
    || new URLSearchParams(window.location.search).get('lang')
    || document.documentElement.lang
    || 'en'
  );
}

function t(key) {
  return COPY[state.language]?.[key] || COPY.en[key] || '';
}

function $(selector) {
  return document.querySelector(selector);
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
  const primary = await primaryFactory();
  if (!primary?.error || !isMissingTaxonomySchemaError(primary.error) || typeof legacyFactory !== 'function') {
    return primary;
  }
  return legacyFactory();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitialSlug() {
  const params = new URLSearchParams(window.location.search);
  const querySlug = String(params.get('slug') || '').trim();
  if (querySlug) return querySlug;

  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments[0] === 'blog' && segments[1]) {
    return decodeURIComponent(String(segments[1] || '').trim());
  }
  return '';
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildMetaDescription(localized) {
  return String(
    localized?.metaDescription
    || localized?.lead
    || localized?.summary
    || ''
  ).trim();
}

function normalizeComparableText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function pickLocalizedText(value, language) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return String(
    value[language]
    || value.en
    || value.pl
    || Object.values(value).find((entry) => typeof entry === 'string')
    || ''
  ).trim();
}

function mapTranslation(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id || null,
    blogPostId: row.blog_post_id || null,
    lang: normalizeBlogUiLanguage(row.lang),
    slug: String(row.slug || '').trim(),
    title: String(row.title || '').trim(),
    metaTitle: String(row.meta_title || '').trim(),
    metaDescription: String(row.meta_description || '').trim(),
    summary: String(row.summary || '').trim(),
    lead: String(row.lead || '').trim(),
    authorName: String(row.author_name || '').trim(),
    authorUrl: String(row.author_url || '').trim(),
    contentHtml: String(row.content_html || '').trim(),
    ogImageUrl: String(row.og_image_url || '').trim(),
  };
}

function buildTranslationsByLang(rows) {
  return safeArray(rows)
    .map(mapTranslation)
    .filter(Boolean)
    .reduce((accumulator, translation) => {
      accumulator[translation.lang] = translation;
      return accumulator;
    }, {});
}

function mapPostFromTranslation(row, siblings = []) {
  const base = row?.blog_post || {};
  const translationsByLang = buildTranslationsByLang(siblings);
  const currentTranslation = mapTranslation(row);
  if (currentTranslation) {
    translationsByLang[currentTranslation.lang] = currentTranslation;
  }

  return {
    id: base.id || null,
    status: base.status || 'draft',
    submissionStatus: base.submission_status || 'draft',
    publishedAt: base.published_at || null,
    coverImageUrl: String(base.cover_image_url || '').trim(),
    coverImageAlt: base.cover_image_alt || {},
    categories: normalizeTaxonomyArray(base.categories),
    categoriesByLang: getTaxonomyByLang(base, 'categories'),
    tags: normalizeTaxonomyArray(base.tags),
    tagsByLang: getTaxonomyByLang(base, 'tags'),
    ctaServices: safeArray(base.cta_services),
    authorProfile: base.author_profile ? {
      id: base.author_profile.id || null,
      name: String(base.author_profile.name || '').trim(),
      username: String(base.author_profile.username || '').trim(),
      avatarUrl: String(base.author_profile.avatar_url || '').trim(),
    } : null,
    resolvedCtaServices: safeArray(row?.resolvedCtaServices || row?.resolved_cta_services),
    relatedPosts: safeArray(row?.relatedPosts || row?.related_posts),
    translationsByLang,
    translation: currentTranslation,
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
  if (!name) {
    return null;
  }
  return {
    name,
    url: String(translation?.authorUrl || '').trim(),
    avatarUrl: String(authorProfile?.avatarUrl || '').trim(),
  };
}

function getLocalizedPost(post, language) {
  const translation = pickTranslation(post, language);
  const categoriesByLang = post?.categoriesByLang || getTaxonomyByLang(post, 'categories');
  const tagsByLang = post?.tagsByLang || getTaxonomyByLang(post, 'tags');
  return {
    ...post,
    translation,
    title: String(translation?.title || t('untitled')).trim(),
    summary: String(translation?.summary || '').trim(),
    lead: String(translation?.lead || '').trim(),
    metaTitle: String(translation?.metaTitle || '').trim(),
    metaDescription: String(translation?.metaDescription || '').trim(),
    contentHtml: String(translation?.contentHtml || '').trim(),
    slug: String(translation?.slug || '').trim(),
    ogImageUrl: String(translation?.ogImageUrl || '').trim(),
    categories: categoriesByLang[language] || categoriesByLang.en || categoriesByLang.pl || [],
    tags: tagsByLang[language] || tagsByLang.en || tagsByLang.pl || [],
    coverImageAlt: pickLocalizedText(post?.coverImageAlt, language) || String(translation?.title || t('untitled')).trim(),
    author: resolveAuthor(post, language),
  };
}

function pickLocalizedMetaTitle(post, language) {
  const translation = pickTranslation(post, language);
  const sibling = pickTranslation(post, language === 'pl' ? 'en' : 'pl');
  const direct = normalizeComparableText(translation?.metaTitle || '');
  const localizedFallback = normalizeComparableText(translation?.title || t('untitled'));
  if (direct) {
    const siblingCandidates = new Set([
      sibling?.metaTitle,
      sibling?.title,
    ].map(normalizeComparableText).filter(Boolean));
    if (localizedFallback && siblingCandidates.has(direct) && direct !== localizedFallback) {
      return localizedFallback;
    }
    return direct;
  }
  return localizedFallback;
}

function pickLocalizedMetaDescription(post, language) {
  const translation = pickTranslation(post, language);
  const sibling = pickTranslation(post, language === 'pl' ? 'en' : 'pl');
  const direct = normalizeComparableText(translation?.metaDescription || '');
  const localizedFallback = normalizeComparableText(translation?.lead || translation?.summary || '');
  if (direct) {
    const siblingCandidates = new Set([
      sibling?.metaTitle,
      sibling?.metaDescription,
      sibling?.lead,
      sibling?.summary,
      sibling?.title,
    ].map(normalizeComparableText).filter(Boolean));
    if (localizedFallback && siblingCandidates.has(direct) && direct !== localizedFallback) {
      return localizedFallback;
    }
    return direct;
  }
  return localizedFallback;
}

function createHeadingId(value, usedIds) {
  const base = normalizeSlug(value) || 'section';
  let candidate = base;
  let counter = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function localizeRelatedPost(post, language) {
  const translation = pickTranslation(post, language);
  return {
    id: post?.id || null,
    slug: String(translation?.slug || '').trim(),
    title: String(translation?.title || t('untitled')).trim(),
    summary: String(translation?.summary || translation?.lead || '').trim(),
    publishedAt: post?.publishedAt || null,
    coverImageUrl: String(post?.coverImageUrl || '').trim() || '/assets/cyprus_logo-1000x1054.png',
    coverImageAlt: pickLocalizedText(post?.coverImageAlt, language) || String(translation?.title || t('untitled')).trim(),
    categories: (post?.categoriesByLang?.[language] || post?.categories || []).map((entry) => String(entry || '').trim()).filter(Boolean),
  };
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(state.language === 'pl' ? 'pl-PL' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

async function fetchSiblingTranslations(blogPostId) {
  const { data, error } = await supabase
    .from('blog_post_translations')
    .select(SIBLING_TRANSLATIONS_SELECT)
    .eq('blog_post_id', blogPostId);

  if (error) {
    throw new Error(error.message || 'Failed to load blog translations');
  }

  return safeArray(data);
}

async function fetchPost(language, slug) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;

  let result = await executeTaxonomyAwareQuery(
    () => supabase
      .from('blog_post_translations')
      .select(POST_SELECT)
      .eq('lang', language)
      .eq('slug', normalizedSlug)
      .maybeSingle(),
    () => supabase
      .from('blog_post_translations')
      .select(POST_SELECT_LEGACY)
      .eq('lang', language)
      .eq('slug', normalizedSlug)
      .maybeSingle()
  );

  if (result.error) {
    throw new Error(result.error.message || 'Failed to load blog post');
  }

  if (!result.data) {
    const fallback = await executeTaxonomyAwareQuery(
      () => supabase
        .from('blog_post_translations')
        .select(POST_SELECT)
        .eq('slug', normalizedSlug)
        .limit(2),
      () => supabase
        .from('blog_post_translations')
        .select(POST_SELECT_LEGACY)
        .eq('slug', normalizedSlug)
        .limit(2)
    );

    if (fallback.error) {
      throw new Error(fallback.error.message || 'Failed to load blog post');
    }

    result = {
      data: safeArray(fallback.data)[0] || null,
      error: null,
    };
  }

  if (!result.data?.blog_post?.id) {
    return null;
  }

  let primary = result.data;
  if (normalizeBlogUiLanguage(primary.lang) !== language) {
    const localized = await executeTaxonomyAwareQuery(
      () => supabase
        .from('blog_post_translations')
        .select(POST_SELECT)
        .eq('blog_post_id', primary.blog_post.id)
        .eq('lang', language)
        .maybeSingle(),
      () => supabase
        .from('blog_post_translations')
        .select(POST_SELECT_LEGACY)
        .eq('blog_post_id', primary.blog_post.id)
        .eq('lang', language)
        .maybeSingle()
    );
    if (localized.error) {
      throw new Error(localized.error.message || 'Failed to load translated blog post');
    }
    if (localized.data) {
      primary = localized.data;
    }
  }

  const siblings = await fetchSiblingTranslations(primary.blog_post.id);
  return mapPostFromTranslation(primary, siblings);
}

function ensureMetaNode(selector, build) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = build();
    document.head.appendChild(node);
  }
  return node;
}

function updateHead(post) {
  const localized = getLocalizedPost(post, state.language);
  const title = pickLocalizedMetaTitle(post, state.language) || localized.title || t('untitled');
  const description = pickLocalizedMetaDescription(post, state.language) || buildMetaDescription(localized);
  const plSlug = post?.translationsByLang?.pl?.slug || localized.slug;
  const enSlug = post?.translationsByLang?.en?.slug || localized.slug;
  const canonicalSlug = state.language === 'pl' ? plSlug || enSlug : enSlug || plSlug;
  const canonicalUrl = state.language === 'pl'
    ? `${window.location.origin}/blog/${encodeURIComponent(canonicalSlug || localized.slug)}?lang=pl`
    : `${window.location.origin}/blog/${encodeURIComponent(canonicalSlug || localized.slug)}`;
  const plUrl = `${window.location.origin}/blog/${encodeURIComponent(plSlug || localized.slug)}?lang=pl`;
  const enUrl = `${window.location.origin}/blog/${encodeURIComponent(enSlug || localized.slug)}`;
  const ogUrl = state.language === 'pl'
    ? `${window.location.origin}/blog/${encodeURIComponent(localized.slug || canonicalSlug || '')}?lang=pl`
    : `${window.location.origin}/blog/${encodeURIComponent(localized.slug || canonicalSlug || '')}`;
  const ogImage = localized.ogImageUrl || localized.coverImageUrl || '/assets/cyprus_logo-1000x1054.png';

  document.title = title;
  ensureMetaNode('meta[name="description"]', () => {
    const node = document.createElement('meta');
    node.name = 'description';
    return node;
  }).setAttribute('content', description);
  ensureMetaNode('meta[name="author"]', () => {
    const node = document.createElement('meta');
    node.name = 'author';
    return node;
  }).setAttribute('content', localized.author?.name || '');
  ensureMetaNode('meta[property="og:title"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:title');
    return node;
  }).setAttribute('content', title);
  ensureMetaNode('meta[property="og:description"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:description');
    return node;
  }).setAttribute('content', description);
  ensureMetaNode('meta[property="og:url"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:url');
    return node;
  }).setAttribute('content', ogUrl);
  ensureMetaNode('meta[property="og:image"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:image');
    return node;
  }).setAttribute('content', new URL(ogImage, window.location.origin).toString());
  ensureMetaNode('meta[property="og:type"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:type');
    return node;
  }).setAttribute('content', 'article');
  ensureMetaNode('meta[property="og:locale"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:locale');
    return node;
  }).setAttribute('content', state.language === 'pl' ? 'pl_PL' : 'en_US');
  ensureMetaNode('meta[property="og:locale:alternate"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:locale:alternate');
    return node;
  }).setAttribute('content', state.language === 'pl' ? 'en_US' : 'pl_PL');

  ensureMetaNode('link[rel="canonical"]', () => {
    const node = document.createElement('link');
    node.rel = 'canonical';
    return node;
  }).setAttribute('href', canonicalUrl);

  ensureMetaNode('link[rel="alternate"][hreflang="pl"]', () => {
    const node = document.createElement('link');
    node.rel = 'alternate';
    node.hreflang = 'pl';
    return node;
  }).setAttribute('href', plUrl);

  ensureMetaNode('link[rel="alternate"][hreflang="en"]', () => {
    const node = document.createElement('link');
    node.rel = 'alternate';
    node.hreflang = 'en';
    return node;
  }).setAttribute('href', enUrl);

  ensureMetaNode('link[rel="alternate"][hreflang="x-default"]', () => {
    const node = document.createElement('link');
    node.rel = 'alternate';
    node.hreflang = 'x-default';
    return node;
  }).setAttribute('href', `${window.location.origin}/blog/${encodeURIComponent(enSlug || canonicalSlug || localized.slug)}`);
}

function syncAddressForLanguage(post) {
  const localized = getLocalizedPost(post, state.language);
  const slug = localized.slug;
  if (!slug) return;

  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = `/blog/${encodeURIComponent(slug)}`;
  if (state.language === 'pl') {
    nextUrl.searchParams.set('lang', 'pl');
  } else {
    nextUrl.searchParams.delete('lang');
  }
  nextUrl.searchParams.delete('slug');
  window.history.replaceState({}, '', nextUrl);
  state.slug = slug;
}

function renderTokens(container, values) {
  if (!(container instanceof HTMLElement)) return;
  const rows = safeArray(values).filter(Boolean);
  container.innerHTML = rows.length
    ? rows.map((value) => `<span class="blog-token">${escapeHtml(value)}</span>`).join('')
    : '';
}

function renderQuickOverview(localized) {
  const card = $('#blogOverviewCard');
  if (!(card instanceof HTMLElement)) {
    return;
  }
  card.hidden = true;
}

function setErrorState(message, tone = 'error') {
  const stateNode = $('#blogPostState');
  const view = $('#blogPostView');
  if (stateNode) {
    stateNode.hidden = false;
    stateNode.dataset.tone = tone;
    stateNode.textContent = message;
  }
  if (view) {
    view.hidden = true;
  }
}

async function renderCtas(post) {
  const section = $('#blogCtaSection');
  const grid = $('#blogCtaGrid');
  if (!section || !grid) return;

  const preloaded = safeArray(post?.resolvedCtaServices).filter((card) => String(card?.language || '').trim() === state.language);
  let cards = preloaded;
  if (cards.length < safeArray(post?.ctaServices).length) {
    const resolved = await resolveBlogCtaServices(supabase, post.ctaServices, state.language);
    if (resolved.length >= cards.length) {
      cards = resolved;
    }
  }
  if (!cards.length) {
    section.hidden = true;
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = cards.map((card) => `
    <article class="blog-cta-card">
      <img class="blog-cta-card__image" src="${escapeHtml(card.imageUrl || '/assets/cyprus_logo-1000x1054.png')}" alt="${escapeHtml(card.title || '')}" loading="lazy" />
      <span class="blog-cta-card__label">${escapeHtml(card.label || '')}</span>
      <h3 class="blog-cta-card__title">${escapeHtml(card.title || '')}</h3>
      ${card.meta ? `<p class="blog-cta-card__meta">${escapeHtml(card.meta)}</p>` : ''}
      <p class="blog-cta-card__description">${escapeHtml(card.description || '')}</p>
      <a class="blog-cta-card__link" href="${escapeHtml(card.href || '#')}">
        <span>${escapeHtml(card.ctaLabel || '')}</span>
        <span aria-hidden="true">→</span>
      </a>
    </article>
  `).join('');

  section.hidden = false;
}

async function fetchRelatedPosts(post) {
  if (!post?.id) {
    return [];
  }

  const { data, error } = await executeTaxonomyAwareQuery(
    () => supabase
      .from('blog_posts')
      .select(RELATED_POSTS_SELECT)
      .eq('status', 'published')
      .eq('submission_status', 'approved')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .neq('id', post.id)
      .order('published_at', { ascending: false })
      .limit(24),
    () => supabase
      .from('blog_posts')
      .select(RELATED_POSTS_SELECT_LEGACY)
      .eq('status', 'published')
      .eq('submission_status', 'approved')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .neq('id', post.id)
      .order('published_at', { ascending: false })
      .limit(24)
  );

  if (error) {
    throw new Error(error.message || 'Failed to load related blog posts');
  }

  const localizedSource = getLocalizedPost(post, state.language);
  const categorySet = new Set(safeArray(localizedSource.categories).map((entry) => String(entry || '').trim()).filter(Boolean));
  const tagSet = new Set(safeArray(localizedSource.tags).map((entry) => String(entry || '').trim()).filter(Boolean));

  const items = safeArray(data).map((row) => {
    const translations = buildTranslationsByLang(row.translations);
    return {
      id: row.id || null,
      status: row.status || 'draft',
      submissionStatus: row.submission_status || 'draft',
      publishedAt: row.published_at || null,
      coverImageUrl: String(row.cover_image_url || '').trim(),
      coverImageAlt: row.cover_image_alt || {},
      categories: normalizeTaxonomyArray(row.categories),
      categoriesByLang: getTaxonomyByLang(row, 'categories'),
      tags: normalizeTaxonomyArray(row.tags),
      tagsByLang: getTaxonomyByLang(row, 'tags'),
      translationsByLang: translations,
      translation: pickTranslation({ translationsByLang: translations }, state.language),
    };
  });

  const scored = items.map((item, index) => {
    const itemCategories = item.categoriesByLang?.[state.language] || item.categories || [];
    const itemTags = item.tagsByLang?.[state.language] || item.tags || [];
    const categoryMatches = itemCategories.filter((entry) => categorySet.has(entry)).length;
    const tagMatches = itemTags.filter((entry) => tagSet.has(entry)).length;
    return {
      item,
      index,
      score: categoryMatches * 4 + tagMatches * 5,
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    const leftDate = new Date(left.item.publishedAt || 0).getTime();
    const rightDate = new Date(right.item.publishedAt || 0).getTime();
    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }
    return left.index - right.index;
  });

  const preferred = scored.filter((entry) => entry.score > 0).slice(0, 3);
  const fallback = scored.filter((entry) => entry.score === 0).slice(0, Math.max(0, 3 - preferred.length));
  return [...preferred, ...fallback].slice(0, 3).map((entry) => entry.item);
}

async function renderRelatedPosts(post) {
  const section = $('#blogRelatedSection');
  const grid = $('#blogRelatedGrid');
  if (!section || !grid) return;

  let relatedPosts = safeArray(post?.relatedPosts);
  if (!relatedPosts.length) {
    try {
      relatedPosts = await fetchRelatedPosts(post);
    } catch (error) {
      console.warn('[blog-post] Failed to load related posts:', error);
      relatedPosts = [];
    }
  }

  if (!relatedPosts.length) {
    section.hidden = true;
    grid.innerHTML = '';
    return;
  }

  $('#blogRelatedEyebrow').textContent = t('relatedEyebrow');
  $('#blogRelatedTitle').textContent = t('relatedTitle');

  grid.innerHTML = relatedPosts.map((postItem) => {
    const localizedItem = localizeRelatedPost(postItem, state.language);
    const href = state.language === 'pl'
      ? `/blog/${encodeURIComponent(localizedItem.slug)}?lang=pl`
      : `/blog/${encodeURIComponent(localizedItem.slug)}`;

    return `
      <article class="blog-card">
        <img class="blog-card__image" src="${escapeHtml(localizedItem.coverImageUrl)}" alt="${escapeHtml(localizedItem.coverImageAlt || localizedItem.title)}" loading="lazy" />
        <div class="blog-card__body">
          <div class="blog-meta-row">
            ${localizedItem.categories[0] ? `<span class="blog-meta-pill">${escapeHtml(localizedItem.categories[0])}</span>` : ''}
            ${localizedItem.publishedAt ? `<span>${escapeHtml(formatDate(localizedItem.publishedAt))}</span>` : ''}
          </div>
          <h3 class="blog-card__title">${escapeHtml(localizedItem.title)}</h3>
          <p class="blog-card__summary">${escapeHtml(localizedItem.summary)}</p>
          <div class="blog-card__footer">
            <a class="blog-card__link" href="${escapeHtml(href)}">
              <span>${escapeHtml(t('relatedLink'))}</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  section.hidden = false;
}

async function render() {
  if (!state.post) {
    setErrorState(state.slug ? t('notFound') : t('missingSlug'));
    return;
  }

  const localized = getLocalizedPost(state.post, state.language);
  updateHead(state.post);
  syncAddressForLanguage(state.post);

  $('#blogPostKicker').textContent = t('kicker');
  $('#blogPostDate').textContent = formatDate(localized.publishedAt);
  $('#blogPostTitle').textContent = localized.title;
  $('#blogPostSummary').textContent = localized.summary || '';
  $('#blogPostCover').src = localized.coverImageUrl || '/assets/cyprus_logo-1000x1054.png';
  $('#blogPostCover').alt = localized.coverImageAlt || localized.title;
  const backLink = $('#blogBackLink');
  if (backLink) {
    backLink.textContent = t('backToList');
    backLink.href = state.language === 'pl' ? '/blog?lang=pl' : '/blog';
  }
  $('#blogSidebarHeading').textContent = t('sidebarHeading');
  $('#blogCtaEyebrow').textContent = t('ctaEyebrow');
  $('#blogCtaTitle').textContent = t('ctaTitle');
  renderTokens($('#blogPostCategoryList'), localized.categories);

  const leadNode = $('#blogPostLead');
  if (leadNode) {
    if (localized.lead) {
      leadNode.hidden = false;
      leadNode.textContent = localized.lead;
    } else {
      leadNode.hidden = true;
      leadNode.textContent = '';
    }
  }

  $('#blogPostContent').innerHTML = localized.contentHtml || '';
  renderQuickOverview(localized);

  const byline = $('#blogPostByline');
  const authorLink = $('#blogPostAuthorLink');
  const authorName = $('#blogPostAuthorName');
  const authorAvatar = $('#blogPostAuthorAvatar');
  $('#blogPostBylineLabel').textContent = t('byline');
  if (localized.author?.name) {
    byline.hidden = false;
    if (localized.author.url) {
      authorLink.hidden = false;
      authorName.hidden = true;
      authorLink.href = localized.author.url;
      authorLink.textContent = localized.author.name;
    } else {
      authorLink.hidden = true;
      authorName.hidden = false;
      authorName.textContent = localized.author.name;
    }

    if (localized.author.avatarUrl) {
      authorAvatar.hidden = false;
      authorAvatar.src = localized.author.avatarUrl;
      authorAvatar.alt = localized.author.name;
    } else {
      authorAvatar.hidden = true;
      authorAvatar.removeAttribute('src');
    }
  } else {
    byline.hidden = true;
  }

  $('#blogPostState').hidden = true;
  $('#blogPostView').hidden = false;
  await renderCtas(state.post);
  await renderRelatedPosts(state.post);
}

async function loadPost(slugOverride = state.slug) {
  const slug = normalizeSlug(slugOverride);
  state.slug = slug;

  if (!slug) {
    state.post = null;
    state.error = t('missingSlug');
    setErrorState(state.error);
    return;
  }

  $('#blogPostState').hidden = false;
  $('#blogPostState').dataset.tone = '';
  $('#blogPostState').textContent = t('loading');

  try {
    state.post = await fetchPost(state.language, slug);
    state.error = state.post ? '' : t('notFound');
  } catch (error) {
    console.error('[blog-post] Failed to load post:', error);
    state.post = null;
    state.error = t('error');
  }

  if (state.error) {
    setErrorState(state.error, 'error');
    return;
  }

  await render();
}

function bindEvents() {
  const handleLanguageChange = async (language) => {
    state.language = normalizeBlogUiLanguage(language);
    if (!state.post) {
      await loadPost(state.slug);
      return;
    }

    const nextTranslation = state.post?.translationsByLang?.[state.language] || null;
    if (nextTranslation?.slug && nextTranslation?.contentHtml) {
      state.slug = normalizeSlug(nextTranslation.slug);
      await render();
      return;
    }

    const nextSlug = nextTranslation?.slug || state.slug;
    await loadPost(nextSlug);
  };

  document.addEventListener('wakacjecypr:languagechange', (event) => {
    handleLanguageChange(event?.detail?.language);
  });

  window.addEventListener('languageChanged', (event) => {
    handleLanguageChange(event?.detail?.language);
  });

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler((language) => {
      handleLanguageChange(language);
    }, 0);
  }
}

bindEvents();

if (state.post && (
  state.slug === normalizeSlug(state.post?.translation?.slug)
  || Object.values(state.post?.translationsByLang || {}).some((translation) => normalizeSlug(translation?.slug) === state.slug)
)) {
  render().catch((error) => {
    console.error('[blog-post] Failed to render preloaded post:', error);
    loadPost(state.slug);
  });
} else {
  loadPost();
}
