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

const COPY = {
  en: {
    loading: 'Loading article...',
    missingSlug: 'This article link is incomplete.',
    notFound: 'We could not find this blog post.',
    error: 'The article could not be loaded right now.',
    kicker: 'CyprusEye story',
    byline: 'Written by',
    sidebarHeading: 'Quick overview',
    ctaEyebrow: 'Continue with CyprusEye',
    ctaTitle: 'Useful services linked to this article.',
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
    ctaEyebrow: 'Kontynuuj z CyprusEye',
    ctaTitle: 'Usługi powiązane z tym artykułem.',
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
    categories: safeArray(base.categories).map((entry) => String(entry || '').trim()).filter(Boolean),
    tags: safeArray(base.tags).map((entry) => String(entry || '').trim()).filter(Boolean),
    ctaServices: safeArray(base.cta_services),
    authorProfile: base.author_profile ? {
      id: base.author_profile.id || null,
      name: String(base.author_profile.name || '').trim(),
      username: String(base.author_profile.username || '').trim(),
      avatarUrl: String(base.author_profile.avatar_url || '').trim(),
    } : null,
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
    coverImageAlt: pickLocalizedText(post?.coverImageAlt, language) || String(translation?.title || t('untitled')).trim(),
    author: resolveAuthor(post, language),
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

  let result = await supabase
    .from('blog_post_translations')
    .select(POST_SELECT)
    .eq('lang', language)
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message || 'Failed to load blog post');
  }

  if (!result.data) {
    result = await supabase
      .from('blog_post_translations')
      .select(POST_SELECT)
      .eq('slug', normalizedSlug)
      .limit(1)
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message || 'Failed to load blog post');
    }
  }

  if (!result.data?.blog_post?.id) {
    return null;
  }

  let primary = result.data;
  if (normalizeBlogUiLanguage(primary.lang) !== language) {
    const localized = await supabase
      .from('blog_post_translations')
      .select(POST_SELECT)
      .eq('blog_post_id', primary.blog_post.id)
      .eq('lang', language)
      .maybeSingle();
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
  const title = localized.metaTitle || localized.title || t('untitled');
  const description = localized.metaDescription || localized.summary || '';
  const plSlug = post?.translationsByLang?.pl?.slug || localized.slug;
  const enSlug = post?.translationsByLang?.en?.slug || localized.slug;
  const canonicalSlug = state.language === 'pl' ? plSlug || enSlug : enSlug || plSlug;
  const canonicalUrl = `${window.location.origin}/blog/${encodeURIComponent(canonicalSlug || localized.slug)}`;
  const plUrl = `${window.location.origin}/blog/${encodeURIComponent(plSlug || localized.slug)}?lang=pl`;
  const enUrl = `${window.location.origin}/blog/${encodeURIComponent(enSlug || localized.slug)}?lang=en`;
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
  }).setAttribute('content', state.language === 'pl' ? 'pl_PL' : 'en_GB');
  ensureMetaNode('meta[property="og:locale:alternate"]', () => {
    const node = document.createElement('meta');
    node.setAttribute('property', 'og:locale:alternate');
    return node;
  }).setAttribute('content', state.language === 'pl' ? 'en_GB' : 'pl_PL');

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

  const cards = await resolveBlogCtaServices(supabase, post.ctaServices, state.language);
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
  $('#blogSidebarHeading').textContent = t('sidebarHeading');
  $('#blogCtaEyebrow').textContent = t('ctaEyebrow');
  $('#blogCtaTitle').textContent = t('ctaTitle');
  renderTokens($('#blogPostCategoryList'), localized.categories);
  renderTokens($('#blogPostTagList'), localized.tags);

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
