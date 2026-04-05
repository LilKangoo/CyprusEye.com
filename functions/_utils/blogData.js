import { createSupabaseClients } from './supabaseAdmin.js';

export const BLOG_DEFAULT_LANGUAGE = 'en';
export const BLOG_SUPPORTED_LANGUAGES = ['pl', 'en'];
export const BLOG_ALLOWED_CTA_TYPES = ['pois', 'trips', 'hotels', 'cars', 'recommendations'];
export const BLOG_LIST_PAGE_SIZE = 12;

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

const BLOG_POST_SELECT = `
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

export function normalizeBlogLanguage(value) {
  return String(value || '').trim().toLowerCase() === 'pl' ? 'pl' : BLOG_DEFAULT_LANGUAGE;
}

export function normalizeBlogSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeCtaServices(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => ({
      type: String(entry?.type || '').trim(),
      resource_id: String(entry?.resource_id || entry?.resourceId || '').trim(),
    }))
    .filter((entry) => BLOG_ALLOWED_CTA_TYPES.includes(entry.type) && entry.resource_id)
    .slice(0, 3);
}

function applyPublishedBlogFilters(query, options = {}) {
  const normalizedCategory = String(options.category || '').trim();
  const normalizedTag = String(options.tag || '').trim();
  const featuredOnly = String(options.featured || '').trim() === '1' || options.featured === true;

  let nextQuery = query
    .eq('status', 'published')
    .eq('submission_status', 'approved')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString());

  if (featuredOnly) {
    nextQuery = nextQuery.eq('featured', true);
  }
  if (normalizedCategory) {
    nextQuery = nextQuery.contains('categories', [normalizedCategory]);
  }
  if (normalizedTag) {
    nextQuery = nextQuery.contains('tags', [normalizedTag]);
  }

  return nextQuery;
}

function getReadClient(env) {
  const { publicClient, adminClient } = createSupabaseClients(env);
  return publicClient || adminClient;
}

function isPublishedRow(row) {
  if (!row || row.status !== 'published' || row.submission_status !== 'approved' || !row.published_at) {
    return false;
  }

  const publishedAtMs = new Date(row.published_at).getTime();
  return Number.isFinite(publishedAtMs) && publishedAtMs <= Date.now();
}

function mapAuthorProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  return {
    id: profile.id || null,
    name: profile.name || '',
    username: profile.username || '',
    avatarUrl: profile.avatar_url || '',
  };
}

function pickLocalizedText(value, language) {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  return (
    value[language]
    || value.en
    || value.pl
    || Object.values(value).find((entry) => typeof entry === 'string')
    || ''
  );
}

function mapTranslation(translation) {
  if (!translation || typeof translation !== 'object') {
    return null;
  }

  return {
    id: translation.id || null,
    blogPostId: translation.blog_post_id || translation.blogPostId || null,
    lang: normalizeBlogLanguage(translation.lang),
    slug: translation.slug || '',
    title: translation.title || '',
    metaTitle: translation.meta_title || '',
    metaDescription: translation.meta_description || '',
    summary: translation.summary || '',
    lead: translation.lead || '',
    authorName: translation.author_name || '',
    authorUrl: translation.author_url || '',
    contentJson: translation.content_json || null,
    contentHtml: translation.content_html || '',
    ogImageUrl: translation.og_image_url || '',
    createdAt: translation.created_at || null,
    updatedAt: translation.updated_at || null,
  };
}

function buildTranslationsByLang(translations) {
  return (Array.isArray(translations) ? translations : [])
    .map(mapTranslation)
    .filter(Boolean)
    .reduce((accumulator, translation) => {
      accumulator[translation.lang] = translation;
      return accumulator;
    }, {});
}

function pickTranslation(translationsByLang, language) {
  return (
    translationsByLang[normalizeBlogLanguage(language)]
    || translationsByLang.en
    || translationsByLang.pl
    || Object.values(translationsByLang)[0]
    || null
  );
}

function resolveAuthor(translation, authorProfile) {
  const displayName = (
    translation?.authorName
    || authorProfile?.name
    || authorProfile?.username
    || ''
  ).trim();

  if (!displayName) {
    return null;
  }

  const url = String(translation?.authorUrl || '').trim();
  return {
    name: displayName,
    url,
    profileId: authorProfile?.id || null,
    avatarUrl: authorProfile?.avatarUrl || '',
  };
}

function mapBlogBase(row, translationsByLang, language) {
  const translation = pickTranslation(translationsByLang, language);
  const authorProfile = mapAuthorProfile(row.author_profile);

  return {
    id: row.id,
    status: row.status || 'draft',
    submissionStatus: row.submission_status || 'draft',
    publishedAt: row.published_at || null,
    coverImageUrl: row.cover_image_url || '',
    coverImageAlt: pickLocalizedText(row.cover_image_alt, language),
    featured: Boolean(row.featured),
    allowComments: Boolean(row.allow_comments),
    categories: Array.isArray(row.categories) ? row.categories : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    ctaServices: normalizeCtaServices(row.cta_services),
    authorProfileId: row.author_profile_id || null,
    ownerPartnerId: row.owner_partner_id || null,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    rejectionReason: row.rejection_reason || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    authorProfile,
    translation,
    translationsByLang,
    author: resolveAuthor(translation, authorProfile),
  };
}

export async function getPublishedBlogList(env, options = {}) {
  const result = await getPublishedBlogListPage(env, options);
  return result.items;
}

export async function getPublishedBlogListPage(env, options = {}) {
  const language = normalizeBlogLanguage(options.language);
  const page = Math.max(1, Number.parseInt(options.page || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(options.limit || BLOG_LIST_PAGE_SIZE, 10) || BLOG_LIST_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const client = getReadClient(env);

  const { data, error, count } = await applyPublishedBlogFilters(
    client.from('blog_posts').select(BLOG_LIST_SELECT, { count: 'exact' }),
    options
  )
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message || 'Failed to load blog list');
  }

  const items = (Array.isArray(data) ? data : []).map((row) => {
    const translationsByLang = buildTranslationsByLang(row.translations);
    return mapBlogBase(row, translationsByLang, language);
  });

  return {
    items,
    page,
    pageSize: limit,
    totalCount: Number.isFinite(count) ? count : items.length,
    filter: {
      featured: String(options.featured || '').trim() === '1' || options.featured === true,
      category: String(options.category || '').trim(),
      tag: String(options.tag || '').trim(),
    },
  };
}

export async function getPublishedBlogPostBySlug(env, options = {}) {
  const language = normalizeBlogLanguage(options.language);
  const slug = normalizeBlogSlug(options.slug);

  if (!slug) {
    return null;
  }

  const client = getReadClient(env);
  const { data, error } = await client
    .from('blog_post_translations')
    .select(BLOG_POST_SELECT)
    .eq('lang', language)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load blog post');
  }

  if (!data?.blog_post) {
    return null;
  }

  if (!isPublishedRow(data.blog_post)) {
    return null;
  }

  const { data: siblingTranslations, error: siblingError } = await client
    .from('blog_post_translations')
    .select(`
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
    `)
    .eq('blog_post_id', data.blog_post.id);

  if (siblingError) {
    throw new Error(siblingError.message || 'Failed to load blog post translations');
  }

  const translationsByLang = buildTranslationsByLang(siblingTranslations);
  const blogPost = mapBlogBase(data.blog_post, translationsByLang, language);

  return {
    ...blogPost,
    translation: {
      ...mapTranslation(data),
      lang: language,
    },
    author: resolveAuthor(mapTranslation(data), blogPost.authorProfile),
  };
}

export async function resolveBlogCtaServices(_env, ctaServices = [], language = BLOG_DEFAULT_LANGUAGE) {
  return normalizeCtaServices(ctaServices).map((entry) => ({
    type: entry.type,
    resourceId: entry.resource_id,
    language: normalizeBlogLanguage(language),
    title: '',
    description: '',
    imageUrl: '',
    href: '',
    resolved: false,
  }));
}
