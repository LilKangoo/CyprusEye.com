import { normalizeBlogLanguage } from './blogData.js';

const CANONICAL_ORIGIN = 'https://www.cypruseye.com';
const DEFAULT_OG_IMAGE = '/assets/cyprus_logo-1000x1054.png';

const BLOG_SEO_COPY = {
  en: {
    list: {
      title: 'CyprusEye Blog | Cyprus travel guides, tips and ideas',
      description:
        'Read CyprusEye guides, local tips and travel inspiration for Cyprus, with helpful links to trips, stays and services.',
      ogTitle: 'CyprusEye Blog | Cyprus travel guides, tips and ideas',
      ogDescription:
        'Cyprus travel stories, practical tips and curated services from CyprusEye.',
    },
    postFallback: {
      title: 'CyprusEye Blog',
      description: 'Travel guides, local tips and curated service links from CyprusEye.',
    },
    notFound: {
      title: 'Article Not Found | CyprusEye Blog',
      description: 'The blog article you requested could not be found.',
    },
  },
  pl: {
    list: {
      title: 'Blog CyprusEye | Przewodniki, porady i inspiracje z Cypru',
      description:
        'Czytaj przewodniki CyprusEye, lokalne porady i inspiracje z Cypru wraz z polecanymi usługami, noclegami i wycieczkami.',
      ogTitle: 'Blog CyprusEye | Przewodniki, porady i inspiracje z Cypru',
      ogDescription:
        'Przewodniki po Cyprze, praktyczne wskazówki i wybrane usługi od CyprusEye.',
    },
    postFallback: {
      title: 'Blog CyprusEye',
      description: 'Przewodniki, lokalne porady i wybrane usługi od CyprusEye.',
    },
    notFound: {
      title: 'Nie znaleziono artykułu | Blog CyprusEye',
      description: 'Nie udało się znaleźć artykułu blogowego, którego szukasz.',
    },
  },
};

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function toAbsoluteUrl(input, search = '') {
  const raw = String(input || '').trim();
  const url = new URL(raw || '/', CANONICAL_ORIGIN);
  const params = new URLSearchParams(search || '');
  params.forEach((value, key) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function normalizeImageUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return toAbsoluteUrl(DEFAULT_OG_IMAGE);
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return toAbsoluteUrl(raw.startsWith('/') ? raw : `/${raw}`);
}

function buildLanguageUrl(pathname, language) {
  const url = new URL(pathname || '/', CANONICAL_ORIGIN);
  if (language) {
    url.searchParams.set('lang', language);
  }
  return url.toString();
}

function serializeForScript(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildBasePayload({
  language,
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  canonicalUrl,
  languageUrls,
  ogType = 'article',
  authorName = '',
  authorUrl = '',
}) {
  const resolvedLanguage = normalizeBlogLanguage(language);
  return {
    language: resolvedLanguage,
    title,
    description,
    ogTitle: ogTitle || title,
    ogDescription: ogDescription || description,
    ogType,
    ogUrl: canonicalUrl,
    ogImage: normalizeImageUrl(ogImage),
    ogLocale: resolvedLanguage === 'pl' ? 'pl_PL' : 'en_GB',
    ogLocaleAlternate: resolvedLanguage === 'pl' ? 'en_GB' : 'pl_PL',
    canonicalUrl,
    languageUrls,
    authorName,
    authorUrl,
  };
}

export function buildBlogAuthorByline(post) {
  const name = String(post?.author?.name || '').trim();
  if (!name) {
    return null;
  }

  const url = String(post?.author?.url || '').trim();
  return {
    name,
    url,
    linked: Boolean(url),
  };
}

export function buildBlogListSeoPayload({ language, requestPathname = '/blog', requestSearch = '' } = {}) {
  const resolvedLanguage = normalizeBlogLanguage(language);
  const copy = BLOG_SEO_COPY[resolvedLanguage].list;
  const canonicalUrl = toAbsoluteUrl(requestPathname);

  return buildBasePayload({
    language: resolvedLanguage,
    title: copy.title,
    description: copy.description,
    ogTitle: copy.ogTitle,
    ogDescription: copy.ogDescription,
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    canonicalUrl,
    languageUrls: {
      pl: buildLanguageUrl(requestPathname, 'pl'),
      en: buildLanguageUrl(requestPathname, 'en'),
      xDefault: toAbsoluteUrl(requestPathname, requestSearch ? '' : ''),
    },
  });
}

export function buildBlogPostSeoPayload({ language, requestPathname = '/blog', requestSearch = '', post = null } = {}) {
  const resolvedLanguage = normalizeBlogLanguage(language);
  const localizedCopy = BLOG_SEO_COPY[resolvedLanguage];

  if (!post?.translation) {
    const canonicalUrl = toAbsoluteUrl(requestPathname);
    return buildBasePayload({
      language: resolvedLanguage,
      title: localizedCopy.notFound.title,
      description: localizedCopy.notFound.description,
      ogImage: DEFAULT_OG_IMAGE,
      canonicalUrl,
      languageUrls: {
        pl: buildLanguageUrl(requestPathname, 'pl'),
        en: buildLanguageUrl(requestPathname, 'en'),
        xDefault: toAbsoluteUrl(requestPathname, requestSearch ? '' : ''),
      },
    });
  }

  const translation = post.translation;
  const translationsByLang = post.translationsByLang || {};
  const plSlug = translationsByLang.pl?.slug || translation.slug;
  const enSlug = translationsByLang.en?.slug || translation.slug;
  const canonicalUrl = toAbsoluteUrl(requestPathname);
  const title = translation.metaTitle || translation.title || localizedCopy.postFallback.title;
  const description = translation.metaDescription || translation.summary || localizedCopy.postFallback.description;
  const byline = buildBlogAuthorByline(post);

  return buildBasePayload({
    language: resolvedLanguage,
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage: translation.ogImageUrl || post.coverImageUrl || DEFAULT_OG_IMAGE,
    ogType: 'article',
    canonicalUrl,
    languageUrls: {
      pl: buildLanguageUrl(`/blog/${plSlug}`, 'pl'),
      en: buildLanguageUrl(`/blog/${enSlug}`, 'en'),
      xDefault: toAbsoluteUrl(`/blog/${enSlug || translation.slug}`),
    },
    authorName: byline?.name || '',
    authorUrl: byline?.url || '',
  });
}

export function injectWindowPayload(html, variableName, data) {
  const script = `  <script>window.${variableName} = ${serializeForScript(data)};</script>`;
  const source = typeof html === 'string' ? html : '';
  if (source.includes('</body>')) {
    return source.replace('</body>', `${script}\n</body>`);
  }
  return `${source}\n${script}`;
}

export function createBlogPlaceholderHtml({ language = 'en', kind = 'list' } = {}) {
  const resolvedLanguage = normalizeBlogLanguage(language);
  const copy = BLOG_SEO_COPY[resolvedLanguage];
  const title = kind === 'post' ? copy.postFallback.title : copy.list.title;
  const description = kind === 'post' ? copy.postFallback.description : copy.list.description;
  const bodyHeading = kind === 'post' ? 'Blog article placeholder' : 'Blog placeholder';

  return `<!doctype html>
<html lang="${resolvedLanguage}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(toAbsoluteUrl('/blog'))}" />
  <meta property="og:image" content="${escapeHtml(toAbsoluteUrl(DEFAULT_OG_IMAGE))}" />
  <meta property="og:locale" content="${resolvedLanguage === 'pl' ? 'pl_PL' : 'en_GB'}" />
  <meta property="og:locale:alternate" content="${resolvedLanguage === 'pl' ? 'en_GB' : 'pl_PL'}" />
  <link rel="canonical" href="${escapeHtml(toAbsoluteUrl('/blog'))}" />
  <link rel="alternate" hreflang="pl" href="${escapeHtml(buildLanguageUrl('/blog', 'pl'))}" />
  <link rel="alternate" hreflang="en" href="${escapeHtml(buildLanguageUrl('/blog', 'en'))}" />
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(toAbsoluteUrl('/blog'))}" />
</head>
<body>
  <main style="font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;">
    <h1>${escapeHtml(bodyHeading)}</h1>
    <p>${escapeHtml(description)}</p>
  </main>
</body>
</html>`;
}
