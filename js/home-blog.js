import { supabase } from '/js/supabaseClient.js';

let homeBlogItems = [];
let homeBlogCarouselUpdate = null;
let homeBlogInitialized = false;

const COPY = {
  en: {
    loading: 'Loading blog posts...',
    empty: 'No blog posts have been published yet.',
    error: 'We could not load blog posts right now.',
    readMore: 'Read article',
    badge: 'Blog',
    untitled: 'Untitled article',
  },
  pl: {
    loading: 'Ładowanie wpisów bloga...',
    empty: 'Nie ma jeszcze opublikowanych wpisów blogowych.',
    error: 'Nie udało się załadować wpisów bloga.',
    readMore: 'Czytaj wpis',
    badge: 'Blog',
    untitled: 'Artykuł bez tytułu',
  },
};

function getLanguage() {
  const lang = String(
    window.appI18n?.language
    || window.getCurrentLanguage?.()
    || document.documentElement?.lang
    || 'en'
  ).toLowerCase();
  return lang.startsWith('pl') ? 'pl' : 'en';
}

function t(key) {
  const lang = getLanguage();
  return COPY[lang]?.[key] || COPY.en[key] || '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initHomeBlogCarousel() {
  const prev = document.querySelector('.home-carousel-container .home-carousel-nav.prev[data-target="#blogHomeGrid"]');
  const next = document.querySelector('.home-carousel-container .home-carousel-nav.next[data-target="#blogHomeGrid"]');
  const grid = document.getElementById('blogHomeGrid');
  if (!prev || !next || !grid) return;
  if (grid.dataset.carouselInit === 'true') return;
  grid.dataset.carouselInit = 'true';

  const scrollBy = () => Math.round(grid.clientWidth * 0.85);
  const updateArrows = () => {
    const maxScroll = grid.scrollWidth - grid.clientWidth - 1;
    const atStart = grid.scrollLeft <= 1;
    const atEnd = grid.scrollLeft >= maxScroll;
    prev.hidden = atStart;
    next.hidden = atEnd;
    const noOverflow = grid.scrollWidth <= grid.clientWidth + 1;
    if (noOverflow) {
      prev.hidden = true;
      next.hidden = true;
    }
  };

  homeBlogCarouselUpdate = updateArrows;

  prev.addEventListener('click', () => {
    grid.scrollBy({ left: -scrollBy(), behavior: 'smooth' });
    window.setTimeout(updateArrows, 350);
  });
  next.addEventListener('click', () => {
    grid.scrollBy({ left: scrollBy(), behavior: 'smooth' });
    window.setTimeout(updateArrows, 350);
  });
  grid.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
}

function pickTranslation(row, language) {
  const translations = Array.isArray(row?.translations) ? row.translations : [];
  const exact = translations.find((entry) => String(entry?.lang || '').toLowerCase() === language);
  if (exact) return exact;
  return translations.find((entry) => String(entry?.lang || '').toLowerCase() === 'en')
    || translations.find((entry) => String(entry?.lang || '').toLowerCase() === 'pl')
    || translations[0]
    || null;
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

function formatPublishedDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const locale = getLanguage() === 'pl' ? 'pl-PL' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function mapPost(row) {
  const translation = pickTranslation(row, getLanguage());
  const fallbackTranslation = pickTranslation(row, 'en') || pickTranslation(row, 'pl');
  return {
    id: row?.id || '',
    featured: !!row?.featured,
    publishedAt: row?.published_at || '',
    coverImageUrl: String(
      translation?.og_image_url
      || row?.cover_image_url
      || '/assets/cyprus_logo-1000x1054.png'
    ),
    coverImageAlt: String(row?.cover_image_alt || translation?.title || fallbackTranslation?.title || t('untitled')),
    title: String(translation?.title || fallbackTranslation?.title || t('untitled')),
    summary: String(translation?.summary || translation?.lead || fallbackTranslation?.summary || fallbackTranslation?.lead || '').trim(),
    href: buildArticleUrl(row, getLanguage()),
  };
}

function renderBlogCards(items) {
  return items.map((row) => {
    const item = mapPost(row);
    return `
    <article class="home-blog-card">
      <a href="${escapeHtml(item.href)}" style="text-decoration:none;color:inherit;display:block;">
        <img
          class="home-blog-card__image"
          src="${escapeHtml(item.coverImageUrl)}"
          alt="${escapeHtml(item.coverImageAlt)}"
          loading="lazy"
          onerror="this.src='/assets/cyprus_logo-1000x1054.png'"
        />
        <div class="home-blog-card__body">
          <div class="home-blog-card__meta">
            <span class="home-blog-card__badge">${escapeHtml(t('badge'))}</span>
            <span>${escapeHtml(formatPublishedDate(item.publishedAt))}</span>
          </div>
          <h3 class="home-blog-card__title">${escapeHtml(item.title)}</h3>
          <p class="home-blog-card__summary">${escapeHtml(item.summary)}</p>
          <span class="home-blog-card__link">${escapeHtml(t('readMore'))} →</span>
        </div>
      </a>
    </article>
  `;
  }).join('');
}

function renderHomeBlog() {
  const grid = document.getElementById('blogHomeGrid');
  if (!grid) return;

  if (!homeBlogItems.length) {
    grid.innerHTML = `
      <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #9ca3af;">
        <p>${escapeHtml(t('empty'))}</p>
      </div>
    `;
    homeBlogCarouselUpdate?.();
    return;
  }

  const progressive = window.CE_HOME_PROGRESSIVE;
  if (progressive?.mount) {
    progressive.mount({
      grid,
      items: homeBlogItems,
      batchByViewport: { mobile: 2, tablet: 4, desktop: 6 },
      emptyHtml: `
        <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #9ca3af;">
          <p>${escapeHtml(t('empty'))}</p>
        </div>
      `,
      renderItems: renderBlogCards,
      onRendered: () => homeBlogCarouselUpdate?.(),
      updateArrows: () => homeBlogCarouselUpdate?.(),
    });
    return;
  }

  grid.innerHTML = renderBlogCards(homeBlogItems);
  homeBlogCarouselUpdate?.();
}

async function loadHomeBlog() {
  const grid = document.getElementById('blogHomeGrid');
  if (!grid) return;

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`
        id,
        featured,
        published_at,
        cover_image_url,
        cover_image_alt,
        translations:blog_post_translations (
          lang,
          slug,
          title,
          summary,
          lead,
          og_image_url
        )
      `)
      .eq('status', 'published')
      .eq('submission_status', 'approved')
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .order('featured', { ascending: false })
      .order('published_at', { ascending: false });

    if (error) throw error;

    homeBlogItems = Array.isArray(data) ? data : [];
    renderHomeBlog();
  } catch (error) {
    console.error('[home-blog] Failed to load posts:', error);
    grid.innerHTML = `
      <div style="flex: 0 0 100%; text-align: center; padding: 40px 20px; color: #ef4444;">
        <p>${escapeHtml(t('error'))}</p>
      </div>
    `;
    homeBlogCarouselUpdate?.();
  }
}

function initHomeBlog() {
  if (homeBlogInitialized) return;
  homeBlogInitialized = true;

  initHomeBlogCarousel();
  loadHomeBlog();

  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler(() => {
      if (!homeBlogItems.length) return;
      renderHomeBlog();
    });
  }

  window.addEventListener('languageChanged', () => {
    if (!homeBlogItems.length) return;
    renderHomeBlog();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeBlog, { once: true });
} else {
  initHomeBlog();
}
