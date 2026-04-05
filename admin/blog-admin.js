const BLOG_PAGE_SIZE = 12;
const BLOG_SERVICE_TYPES = [
  { type: 'trips', label: 'Trips' },
  { type: 'hotels', label: 'Hotels' },
  { type: 'cars', label: 'Cars' },
  { type: 'pois', label: 'POIs' },
  { type: 'recommendations', label: 'Recommendations' },
];

const BLOG_TABLE_SELECT = `
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
  created_by,
  updated_by,
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
    content_json,
    content_html,
    og_image_url,
    created_at,
    updated_at
  )
`;

const blogAdminState = {
  loaded: false,
  items: [],
  partners: [],
  partnersById: {},
  profiles: [],
  profilesById: {},
  resourcesByType: {},
  currentPage: 1,
  filterSearch: '',
  filterStatus: '',
  filterSubmission: '',
  filterPartner: '',
  formMode: 'create',
  editingId: '',
  slugDirtyByLang: { pl: false, en: false },
  editors: new Map(),
  tiptapModules: null,
  tiptapFallback: false,
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function getBlogFormRoot() {
  return $('#blogForm') || $('#blogFormModal') || document;
}

function getSupabaseClient() {
  if (typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }
  return window.sb || window.__SB__ || null;
}

function showToastSafe(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  console[type === 'error' ? 'error' : 'log'](`[blog-admin:${type}] ${message}`);
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

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsvList(value) {
  return Array.from(new Set(
    String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  ));
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toDatetimeLocalValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeI18nText(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (!value || typeof value !== 'object') return fallback;
  return String(value.en || value.pl || Object.values(value).find((entry) => typeof entry === 'string') || fallback).trim();
}

function normalizeBlogRow(row) {
  const translations = safeArray(row?.translations).reduce((accumulator, translation) => {
    const lang = String(translation?.lang || '').trim().toLowerCase();
    if (!lang) return accumulator;
    accumulator[lang] = {
      id: translation?.id || null,
      lang,
      slug: String(translation?.slug || '').trim(),
      title: String(translation?.title || '').trim(),
      meta_title: String(translation?.meta_title || '').trim(),
      meta_description: String(translation?.meta_description || '').trim(),
      summary: String(translation?.summary || '').trim(),
      lead: String(translation?.lead || '').trim(),
      author_name: String(translation?.author_name || '').trim(),
      author_url: String(translation?.author_url || '').trim(),
      content_json: translation?.content_json || null,
      content_html: String(translation?.content_html || '').trim(),
      og_image_url: String(translation?.og_image_url || '').trim(),
    };
    return accumulator;
  }, {});

  return {
    id: row?.id || '',
    status: String(row?.status || 'draft'),
    submission_status: String(row?.submission_status || 'draft'),
    published_at: row?.published_at || null,
    cover_image_url: String(row?.cover_image_url || '').trim(),
    cover_image_alt: row?.cover_image_alt && typeof row.cover_image_alt === 'object' ? row.cover_image_alt : {},
    featured: Boolean(row?.featured),
    allow_comments: Boolean(row?.allow_comments),
    categories: safeArray(row?.categories).map((entry) => String(entry || '').trim()).filter(Boolean),
    tags: safeArray(row?.tags).map((entry) => String(entry || '').trim()).filter(Boolean),
    cta_services: safeArray(row?.cta_services).slice(0, 3).map((entry) => ({
      type: String(entry?.type || '').trim(),
      resource_id: String(entry?.resource_id || entry?.resourceId || '').trim(),
    })).filter((entry) => entry.type && entry.resource_id),
    author_profile_id: row?.author_profile_id || '',
    owner_partner_id: row?.owner_partner_id || '',
    reviewed_at: row?.reviewed_at || null,
    reviewed_by: row?.reviewed_by || '',
    rejection_reason: String(row?.rejection_reason || '').trim(),
    created_by: row?.created_by || '',
    updated_by: row?.updated_by || '',
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    translations,
  };
}

function getProfileLabel(profileId) {
  const profile = blogAdminState.profilesById[profileId];
  if (!profile) return '';
  return profile.name || profile.username || String(profile.id).slice(0, 8);
}

function getPartnerLabel(partnerId) {
  const partner = blogAdminState.partnersById[partnerId];
  if (!partner) return 'Admin';
  return partner.name || partner.slug || String(partner.id).slice(0, 8);
}

function getDisplayTranslation(post, language = 'en') {
  return post?.translations?.[language] || post?.translations?.en || post?.translations?.pl || { title: '', slug: '' };
}

function getDisplayAuthor(post, language = 'en') {
  const translation = getDisplayTranslation(post, language);
  const name = String(translation?.author_name || '').trim() || getProfileLabel(post?.author_profile_id || '');
  return name || '—';
}

function getModal() {
  return $('#blogFormModal');
}

function openModal() {
  const modal = getModal();
  if (modal) modal.hidden = false;
}

function closeModal() {
  const modal = getModal();
  if (modal) modal.hidden = true;
  const form = $('#blogForm');
  if (form) form.reset();
  destroyEditors();
  blogAdminState.editingId = '';
  blogAdminState.formMode = 'create';
  blogAdminState.slugDirtyByLang = { pl: false, en: false };
  const translationsMount = $('#blogFormTranslations');
  if (translationsMount) {
    translationsMount.innerHTML = '';
  }
  const ctaRows = $('#blogFormCtaRows');
  if (ctaRows) {
    ctaRows.innerHTML = '';
  }
  setCoverPreview('');
  setReviewMeta(null);
}

function setReviewMeta(post = null) {
  const node = $('#blogReviewMeta');
  if (!node) return;
  if (!post?.reviewed_at) {
    node.textContent = 'Not reviewed yet.';
    return;
  }
  const rejection = post?.submission_status === 'rejected' && post?.rejection_reason
    ? ` • reason: ${post.rejection_reason}`
    : '';
  node.textContent = `Reviewed ${formatDateTime(post.reviewed_at)} • reviewer ${String(post.reviewed_by || '').slice(0, 8) || 'unknown'}${rejection}`;
}

function setCoverPreview(url) {
  const wrap = $('#blogFormCoverPreview');
  const img = $('#blogFormCoverPreviewImage');
  const normalized = String(url || '').trim();
  if (!wrap || !img) return;
  if (!normalized) {
    wrap.hidden = true;
    img.removeAttribute('src');
    return;
  }
  img.src = normalized;
  wrap.hidden = false;
}

function createStatusBadge(value, kind = 'status') {
  const normalized = String(value || '').trim().toLowerCase();
  const tone = (
    normalized === 'published' || normalized === 'approved' ? 'success'
      : normalized === 'pending' || normalized === 'scheduled' ? 'warning'
        : normalized === 'rejected' || normalized === 'archived' ? 'danger'
          : 'muted'
  );
  return `<span class="blog-admin-badge blog-admin-badge--${tone}">${escapeHtml(kind === 'submission' ? normalized : normalized || 'draft')}</span>`;
}

function renderStats(rows) {
  const total = rows.length;
  const published = rows.filter((row) => row.status === 'published' && row.submission_status === 'approved').length;
  const pending = rows.filter((row) => row.submission_status === 'pending').length;
  const partnerOwned = rows.filter((row) => row.owner_partner_id).length;
  const pairs = [
    ['blogStatTotal', total],
    ['blogStatPublished', published],
    ['blogStatPending', pending],
    ['blogStatPartnerOwned', partnerOwned],
  ];
  pairs.forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  });
}

function getFilteredRows() {
  const search = blogAdminState.filterSearch.trim().toLowerCase();
  const status = blogAdminState.filterStatus;
  const submission = blogAdminState.filterSubmission;
  const partner = blogAdminState.filterPartner;

  return blogAdminState.items.filter((post) => {
    if (status && post.status !== status) return false;
    if (submission && post.submission_status !== submission) return false;
    if (partner === '__admin__' && post.owner_partner_id) return false;
    if (partner && partner !== '__admin__' && String(post.owner_partner_id || '') !== partner) return false;
    if (!search) return true;

    const en = getDisplayTranslation(post, 'en');
    const pl = getDisplayTranslation(post, 'pl');
    const haystack = [
      post.id,
      post.status,
      post.submission_status,
      post.categories.join(' '),
      post.tags.join(' '),
      post.rejection_reason,
      post.owner_partner_id ? getPartnerLabel(post.owner_partner_id) : 'admin',
      getDisplayAuthor(post, 'en'),
      getDisplayAuthor(post, 'pl'),
      en.title,
      en.slug,
      pl.title,
      pl.slug,
    ].join(' ').toLowerCase();
    return haystack.includes(search);
  });
}

function renderPagination(filteredRows) {
  const container = $('#blogAdminPagination');
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / BLOG_PAGE_SIZE));
  if (blogAdminState.currentPage > totalPages) {
    blogAdminState.currentPage = totalPages;
  }

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const current = blogAdminState.currentPage;
  const pages = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || Math.abs(page - current) <= 1) {
      pages.push(page);
    }
  }
  const uniquePages = Array.from(new Set(pages));

  container.innerHTML = `
    <button class="btn-secondary" type="button" data-blog-admin-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}>Previous</button>
    ${uniquePages.map((page, index) => {
      const prev = uniquePages[index - 1];
      const gap = prev && page - prev > 1 ? '<span class="blog-admin-pagination__gap">…</span>' : '';
      return `${gap}<button class="blog-admin-pagination__page${page === current ? ' is-active' : ''}" type="button" data-blog-admin-page="${page}">${page}</button>`;
    }).join('')}
    <button class="btn-secondary" type="button" data-blog-admin-page="${current + 1}" ${current >= totalPages ? 'disabled' : ''}>Next</button>
  `;
}

function renderPartnerFilterOptions() {
  const select = $('#blogAdminPartnerFilter');
  if (!select) return;
  const current = String(select.value || blogAdminState.filterPartner || '').trim();
  const options = blogAdminState.partners
    .filter((partner) => Boolean(partner.can_manage_blog))
    .map((partner) => `<option value="${escapeHtml(partner.id)}">${escapeHtml(partner.name || partner.slug || partner.id)}</option>`)
    .join('');
  select.innerHTML = `<option value="">All</option><option value="__admin__">Admin-owned</option>${options}`;
  select.value = current || '';
}

function buildPreviewUrl(post, lang = 'en') {
  const translation = getDisplayTranslation(post, lang);
  const slug = String(translation?.slug || '').trim();
  if (!slug) return lang === 'pl' ? '/blog?lang=pl' : '/blog';
  return lang === 'pl'
    ? `/blog/${encodeURIComponent(slug)}?lang=pl`
    : `/blog/${encodeURIComponent(slug)}`;
}

function renderTable() {
  const tbody = $('#blogTableBody');
  if (!tbody) return;

  const filteredRows = getFilteredRows();
  renderStats(blogAdminState.items);
  renderPagination(filteredRows);

  if (!filteredRows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">No blog posts match current filters.</td></tr>';
    return;
  }

  const start = (blogAdminState.currentPage - 1) * BLOG_PAGE_SIZE;
  const visibleRows = filteredRows.slice(start, start + BLOG_PAGE_SIZE);

  tbody.innerHTML = visibleRows.map((post) => {
    const en = getDisplayTranslation(post, 'en');
    const pl = getDisplayTranslation(post, 'pl');
    const owner = post.owner_partner_id ? getPartnerLabel(post.owner_partner_id) : 'Admin';
    const ownerMeta = post.owner_partner_id
      ? `<div class="blog-admin-cell-meta">${escapeHtml(blogAdminState.partnersById[post.owner_partner_id]?.slug || '')}</div>`
      : '<div class="blog-admin-cell-meta">Internal editorial</div>';
    const articleTitle = en.title || pl.title || 'Untitled';
    const articleSlug = en.slug || pl.slug || '—';
    const byline = getDisplayAuthor(post, 'en');
    const previewUrl = buildPreviewUrl(post, 'en');
    const canApprove = post.submission_status !== 'approved';
    const canReject = post.submission_status !== 'rejected';

    return `
      <tr>
        <td data-label="Article">
          <div class="blog-admin-article-cell">
            <strong>${escapeHtml(articleTitle)}</strong>
            <div class="blog-admin-cell-meta">${escapeHtml(articleSlug)}</div>
            <div class="blog-admin-cell-meta">${escapeHtml(byline)}</div>
          </div>
        </td>
        <td data-label="Owner">
          <div class="blog-admin-article-cell">
            <strong>${escapeHtml(owner)}</strong>
            ${ownerMeta}
          </div>
        </td>
        <td data-label="Status">${createStatusBadge(post.status)}</td>
        <td data-label="Submission">${createStatusBadge(post.submission_status, 'submission')}</td>
        <td data-label="Published">${escapeHtml(formatDateTime(post.published_at))}</td>
        <td data-label="Updated">${escapeHtml(formatDateTime(post.updated_at || post.created_at))}</td>
        <td data-label="Actions" style="text-align: right;">
          <div class="blog-admin-actions">
            <button class="btn-small btn-secondary" type="button" onclick="window.editBlogPost('${escapeHtml(post.id)}')">Edit</button>
            <a class="btn-small btn-secondary" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener">Preview</a>
            ${canApprove ? `<button class="btn-small btn-secondary" type="button" onclick="window.approveBlogPost('${escapeHtml(post.id)}')">Approve</button>` : ''}
            ${canReject ? `<button class="btn-small btn-secondary" type="button" onclick="window.rejectBlogPost('${escapeHtml(post.id)}')">Reject</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadPartners() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Database connection not available');

  const attempts = [
    'id, name, slug, status, can_manage_blog, can_auto_publish_blog',
    'id, name, slug, status',
  ];

  let rows = [];
  for (const select of attempts) {
    const { data, error } = await client
      .from('partners')
      .select(select)
      .order('name', { ascending: true })
      .limit(300);
    if (!error) {
      rows = safeArray(data).map((partner) => ({
        id: partner.id,
        name: String(partner.name || '').trim(),
        slug: String(partner.slug || '').trim(),
        status: String(partner.status || 'active').trim(),
        can_manage_blog: Boolean(partner.can_manage_blog),
        can_auto_publish_blog: Boolean(partner.can_auto_publish_blog),
      }));
      break;
    }
  }

  blogAdminState.partners = rows;
  blogAdminState.partnersById = rows.reduce((accumulator, partner) => {
    accumulator[partner.id] = partner;
    return accumulator;
  }, {});
}

async function loadProfiles() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Database connection not available');

  const { data, error } = await client
    .from('profiles')
    .select('id, name, username, avatar_url')
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(error.message || 'Failed to load profiles');
  }

  const rows = safeArray(data).map((profile) => ({
    id: profile.id,
    name: String(profile.name || '').trim(),
    username: String(profile.username || '').trim(),
    avatar_url: String(profile.avatar_url || '').trim(),
  }));
  blogAdminState.profiles = rows;
  blogAdminState.profilesById = rows.reduce((accumulator, profile) => {
    accumulator[profile.id] = profile;
    return accumulator;
  }, {});
}

function populateOwnerPartnerSelect(selectedPartnerId = '') {
  const select = $('#blogFormOwnerPartner');
  if (!select) return;
  const options = blogAdminState.partners
    .filter((partner) => partner.can_manage_blog || partner.id === selectedPartnerId)
    .map((partner) => {
      const suffix = partner.can_auto_publish_blog ? ' • auto-publish' : '';
      return `<option value="${escapeHtml(partner.id)}">${escapeHtml(partner.name || partner.slug || partner.id)}${escapeHtml(suffix)}</option>`;
    })
    .join('');
  select.innerHTML = `<option value="">Admin-owned</option>${options}`;
  select.value = selectedPartnerId || '';
}

function populateAuthorProfileSelect(selectedProfileId = '') {
  const select = $('#blogFormAuthorProfile');
  if (!select) return;
  const options = blogAdminState.profiles
    .map((profile) => {
      const label = profile.name || profile.username || profile.id;
      const meta = profile.username && profile.name ? ` • @${profile.username}` : '';
      return `<option value="${escapeHtml(profile.id)}">${escapeHtml(label)}${escapeHtml(meta)}</option>`;
    })
    .join('');
  select.innerHTML = `<option value="">No profile fallback</option>${options}`;
  select.value = selectedProfileId || '';
}

async function loadBlogAdminData() {
  const client = getSupabaseClient();
  if (!client) {
    showToastSafe('Database connection not available', 'error');
    return;
  }

  const tbody = $('#blogTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading blog posts...</td></tr>';
  }

  try {
    if (!blogAdminState.partners.length) {
      await loadPartners();
    }
    if (!blogAdminState.profiles.length) {
      await loadProfiles();
    }
    renderPartnerFilterOptions();

    const { data, error } = await client
      .from('blog_posts')
      .select(BLOG_TABLE_SELECT)
      .order('updated_at', { ascending: false })
      .limit(300);

    if (error) {
      throw new Error(error.message || 'Failed to load blog posts');
    }

    blogAdminState.items = safeArray(data).map(normalizeBlogRow);
    blogAdminState.loaded = true;
    renderTable();
  } catch (error) {
    console.error('[blog-admin] Failed to load blog posts:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-loading" style="color: var(--admin-danger);">Error: ${escapeHtml(error.message || 'Failed to load blog posts')}</td></tr>`;
    }
    showToastSafe(error.message || 'Failed to load blog posts', 'error');
  }
}

async function ensureFormOptionsLoaded() {
  if (!blogAdminState.partners.length) {
    await loadPartners();
  }
  if (!blogAdminState.profiles.length) {
    await loadProfiles();
  }
}

function getInitialTranslationValues(post = null) {
  return {
    pl: {
      ...(post?.translations?.pl || {}),
      cover_alt: String(post?.cover_image_alt?.pl || '').trim(),
    },
    en: {
      ...(post?.translations?.en || {}),
      cover_alt: String(post?.cover_image_alt?.en || '').trim(),
    },
  };
}

function renderCtaRows(rows = []) {
  const container = $('#blogFormCtaRows');
  if (!container) return;

  const normalized = safeArray(rows).slice(0, 3);
  if (!normalized.length) {
    container.innerHTML = '<div class="blog-empty-state">No linked services yet. Add up to 3 CTA cards.</div>';
    return;
  }

  container.innerHTML = normalized.map((row, index) => `
    <div class="blog-cta-row" data-blog-cta-row data-index="${index}">
      <label class="admin-form-field">
        <span>Service type</span>
        <select data-blog-cta-type>
          <option value="">Select type</option>
          ${BLOG_SERVICE_TYPES.map((service) => `<option value="${escapeHtml(service.type)}" ${service.type === row.type ? 'selected' : ''}>${escapeHtml(service.label)}</option>`).join('')}
        </select>
      </label>
      <label class="admin-form-field blog-cta-row__resource">
        <span>Resource</span>
        <select data-blog-cta-resource>
          <option value="">Select item</option>
        </select>
      </label>
      <button class="btn-secondary blog-cta-row__remove" type="button" data-blog-cta-remove="${index}">Remove</button>
    </div>
  `).join('');

  $$('.blog-cta-row').forEach((row, index) => {
    const item = normalized[index] || {};
    void populateServiceResourceOptions(row, item.type, item.resource_id);
  });

  const addButton = $('#btnBlogAddCta');
  if (addButton) {
    addButton.disabled = normalized.length >= 3;
  }
}

function addCtaRow() {
  const rows = collectCtaRows();
  if (rows.length >= 3) {
    showToastSafe('You can link up to 3 services', 'warning');
    return;
  }
  rows.push({ type: '', resource_id: '' });
  renderCtaRows(rows);
}

function removeCtaRow(index) {
  const rows = collectCtaRows();
  rows.splice(index, 1);
  renderCtaRows(rows);
}

function normalizeResourceRow(type, row) {
  if (type === 'trips') {
    return {
      id: row.id,
      label: normalizeI18nText(row.title, row.slug || row.id),
      meta: String(row.start_city || '').trim(),
    };
  }
  if (type === 'hotels') {
    return {
      id: row.id,
      label: normalizeI18nText(row.title, row.slug || row.id),
      meta: String(row.city || '').trim(),
    };
  }
  if (type === 'cars') {
    return {
      id: row.id,
      label: normalizeI18nText(row.car_model, normalizeI18nText(row.car_type, row.id)),
      meta: String(row.location || '').trim(),
    };
  }
  if (type === 'pois') {
    return {
      id: row.id,
      label: normalizeI18nText(row.title, row.name_en || row.name_pl || row.slug || row.id),
      meta: String(row.location_name || row.city || '').trim(),
    };
  }
  return {
    id: row.id,
    label: String(row.title_en || row.title_pl || row.name_en || row.name_pl || row.slug || row.id).trim(),
    meta: String(row.location_name || row.category || '').trim(),
  };
}

async function loadResourcesForType(type) {
  const normalizedType = String(type || '').trim();
  if (!normalizedType) return [];
  if (Array.isArray(blogAdminState.resourcesByType[normalizedType])) {
    return blogAdminState.resourcesByType[normalizedType];
  }

  const client = getSupabaseClient();
  if (!client) throw new Error('Database connection not available');

  let data = [];
  let error = null;

  if (normalizedType === 'trips') {
    ({ data, error } = await client.from('trips').select('id, slug, title, start_city').order('updated_at', { ascending: false }).limit(300));
  } else if (normalizedType === 'hotels') {
    ({ data, error } = await client.from('hotels').select('id, slug, title, city').order('updated_at', { ascending: false }).limit(300));
  } else if (normalizedType === 'cars') {
    ({ data, error } = await client.from('car_offers').select('id, car_model, car_type, location').order('updated_at', { ascending: false }).limit(300));
  } else if (normalizedType === 'pois') {
    ({ data, error } = await client.from('pois').select('*').order('updated_at', { ascending: false }).limit(300));
  } else if (normalizedType === 'recommendations') {
    ({ data, error } = await client.from('recommendations').select('*').order('updated_at', { ascending: false }).limit(300));
  }

  if (error) {
    throw new Error(error.message || `Failed to load ${normalizedType}`);
  }

  const rows = safeArray(data).map((row) => normalizeResourceRow(normalizedType, row)).filter((row) => row.id);
  blogAdminState.resourcesByType[normalizedType] = rows;
  return rows;
}

async function populateServiceResourceOptions(rowNode, type, selectedId = '') {
  const select = $('[data-blog-cta-resource]', rowNode);
  if (!select) return;
  const normalizedType = String(type || '').trim();
  if (!normalizedType) {
    select.innerHTML = '<option value="">Select item</option>';
    return;
  }

  select.innerHTML = '<option value="">Loading…</option>';
  try {
    const rows = await loadResourcesForType(normalizedType);
    const options = rows.map((row) => {
      const label = row.meta ? `${row.label} — ${row.meta}` : row.label;
      return `<option value="${escapeHtml(row.id)}">${escapeHtml(label)}</option>`;
    }).join('');
    select.innerHTML = `<option value="">Select item</option>${options}`;
    select.value = selectedId || '';
  } catch (error) {
    select.innerHTML = '<option value="">Failed to load items</option>';
    showToastSafe(error.message || 'Failed to load service items', 'error');
  }
}

function collectCtaRows() {
  return $$('.blog-cta-row').map((row) => ({
    type: String($('[data-blog-cta-type]', row)?.value || '').trim(),
    resource_id: String($('[data-blog-cta-resource]', row)?.value || '').trim(),
  })).filter((row) => row.type && row.resource_id).slice(0, 3);
}

function destroyEditors() {
  blogAdminState.editors.forEach((entry) => {
    try {
      entry?.editor?.destroy?.();
    } catch (_e) {
    }
  });
  blogAdminState.editors.clear();
}

async function ensureTiptapModules() {
  if (blogAdminState.tiptapModules) {
    return blogAdminState.tiptapModules;
  }

  const runtimeNote = $('#blogEditorRuntimeNote');
  if (runtimeNote) runtimeNote.textContent = 'Loading TipTap editor…';

  try {
    const [coreModule, starterKitModule, linkModule, imageModule] = await Promise.all([
      import('https://esm.sh/@tiptap/core@2.26.1'),
      import('https://esm.sh/@tiptap/starter-kit@2.26.1'),
      import('https://esm.sh/@tiptap/extension-link@2.26.1'),
      import('https://esm.sh/@tiptap/extension-image@2.26.1'),
    ]);

    blogAdminState.tiptapModules = {
      Editor: coreModule.Editor,
      StarterKit: starterKitModule.default,
      Link: linkModule.default,
      Image: imageModule.default,
    };
    blogAdminState.tiptapFallback = false;
    if (runtimeNote) runtimeNote.textContent = 'TipTap editor active';
    return blogAdminState.tiptapModules;
  } catch (error) {
    console.warn('[blog-admin] TipTap failed to load, using HTML fallback:', error);
    blogAdminState.tiptapFallback = true;
    if (runtimeNote) runtimeNote.textContent = 'TipTap unavailable in this environment. HTML fallback enabled.';
    return null;
  }
}

function getEditorContentValue(lang) {
  const entry = blogAdminState.editors.get(lang);
  if (entry?.editor) {
    return {
      content_json: entry.editor.getJSON(),
      content_html: entry.editor.getHTML(),
    };
  }
  const textarea = $(`[data-blog-editor-fallback="${lang}"]`, getBlogFormRoot());
  return {
    content_json: {
      type: 'doc',
      content: [],
    },
    content_html: String(textarea?.value || '').trim(),
  };
}

async function initializeEditors(translations) {
  destroyEditors();
  const modules = await ensureTiptapModules();
  const formRoot = getBlogFormRoot();

  window.BLOG_TRANSLATION_LANGUAGES.forEach((lang) => {
    const host = $(`[data-blog-editor-host="${lang.code}"]`, formRoot);
    const fallback = $(`[data-blog-editor-fallback="${lang.code}"]`, formRoot);
    const initial = translations?.[lang.code] || {};
    if (!host || !fallback) return;

    host.innerHTML = '';
    fallback.hidden = true;

    if (!modules) {
      fallback.hidden = false;
      fallback.value = String(initial.content_html || '').trim();
      host.hidden = true;
      return;
    }

    host.hidden = false;
    const editorMount = document.createElement('div');
    editorMount.className = 'blog-editor-surface';
    host.appendChild(editorMount);

    const editor = new modules.Editor({
      element: editorMount,
      extensions: [
        modules.StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        modules.Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
        }),
        modules.Image,
      ],
      content: initial.content_json && Object.keys(initial.content_json).length ? initial.content_json : (initial.content_html || ''),
      editorProps: {
        attributes: {
          class: 'blog-editor-surface__inner',
          spellcheck: 'true',
        },
      },
    });

    blogAdminState.editors.set(lang.code, { editor });
  });
}

function runEditorCommand(lang, action) {
  const entry = blogAdminState.editors.get(lang);
  const editor = entry?.editor;
  if (!editor) return;

  if (action === 'paragraph') {
    editor.chain().focus().setParagraph().run();
    return;
  }
  if (action === 'heading2') {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    return;
  }
  if (action === 'heading3') {
    editor.chain().focus().toggleHeading({ level: 3 }).run();
    return;
  }
  if (action === 'bold') {
    editor.chain().focus().toggleBold().run();
    return;
  }
  if (action === 'italic') {
    editor.chain().focus().toggleItalic().run();
    return;
  }
  if (action === 'bulletList') {
    editor.chain().focus().toggleBulletList().run();
    return;
  }
  if (action === 'orderedList') {
    editor.chain().focus().toggleOrderedList().run();
    return;
  }
  if (action === 'blockquote') {
    editor.chain().focus().toggleBlockquote().run();
    return;
  }
  if (action === 'link') {
    const current = editor.getAttributes('link')?.href || '';
    const href = window.prompt('Enter link URL', current);
    if (href === null) return;
    const clean = String(href || '').trim();
    if (!clean) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: clean }).run();
    return;
  }
  if (action === 'image') {
    const src = window.prompt('Enter image URL');
    if (!src) return;
    editor.chain().focus().setImage({ src: String(src).trim() }).run();
    return;
  }
  if (action === 'clear') {
    editor.chain().focus().clearContent(true).run();
  }
}

function attachTranslationFieldListeners() {
  const formRoot = getBlogFormRoot();
  window.BLOG_TRANSLATION_LANGUAGES.forEach((lang) => {
    const titleInput = $(`[data-blog-title-input="${lang.code}"]`, formRoot);
    const slugInput = $(`[data-blog-slug-input="${lang.code}"]`, formRoot);
    if (!titleInput || !slugInput) return;

    titleInput.addEventListener('input', () => {
      if (blogAdminState.slugDirtyByLang[lang.code]) return;
      slugInput.value = slugify(titleInput.value || '');
    });

    slugInput.addEventListener('input', () => {
      blogAdminState.slugDirtyByLang[lang.code] = Boolean(String(slugInput.value || '').trim());
      slugInput.value = slugify(slugInput.value || '');
    });
  });
}

function populateForm(post = null) {
  blogAdminState.slugDirtyByLang = {
    pl: Boolean(post?.translations?.pl?.slug),
    en: Boolean(post?.translations?.en?.slug),
  };

  $('#blogFormId').value = post?.id || '';
  $('#blogFormStatus').value = post?.status || 'draft';
  $('#blogFormSubmissionStatus').value = post?.submission_status || 'draft';
  $('#blogFormPublishedAt').value = toDatetimeLocalValue(post?.published_at || '');
  $('#blogFormFeatured').checked = Boolean(post?.featured);
  $('#blogFormAllowComments').checked = Boolean(post?.allow_comments);
  $('#blogFormCoverUrl').value = post?.cover_image_url || '';
  $('#blogFormCategories').value = safeArray(post?.categories).join(', ');
  $('#blogFormTags').value = safeArray(post?.tags).join(', ');
  $('#blogFormRejectionReason').value = post?.rejection_reason || '';
  setReviewMeta(post);
  populateOwnerPartnerSelect(post?.owner_partner_id || '');
  populateAuthorProfileSelect(post?.author_profile_id || '');
  setCoverPreview(post?.cover_image_url || '');

  const translations = getInitialTranslationValues(post);
  const translationsMount = $('#blogFormTranslations');
  if (translationsMount && typeof window.renderBlogTranslationFields === 'function') {
    translationsMount.innerHTML = window.renderBlogTranslationFields(translations);
  }
  renderCtaRows(post?.cta_services || []);
  attachTranslationFieldListeners();
  return translations;
}

async function openBlogForm(postId = '') {
  try {
    await ensureFormOptionsLoaded();

    const post = postId
      ? blogAdminState.items.find((item) => item.id === postId) || null
      : null;

    blogAdminState.formMode = post ? 'edit' : 'create';
    blogAdminState.editingId = post?.id || '';
    $('#blogFormModalTitle').textContent = post ? 'Edit blog post' : 'New blog post';
    $('#btnDeleteBlogPost').hidden = !post;

    const translations = populateForm(post);
    openModal();
    await initializeEditors(translations);
  } catch (error) {
    console.error('[blog-admin] Failed to open form:', error);
    showToastSafe(error.message || 'Failed to open blog form', 'error');
  }
}

async function handleCoverUpload() {
  const input = $('#blogFormCoverFile');
  const file = input?.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToastSafe('Please select an image file', 'error');
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showToastSafe('Image must be smaller than 8MB', 'error');
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    showToastSafe('Database connection not available', 'error');
    return;
  }

  const formRoot = getBlogFormRoot();
  const slugEn = slugify($('[name="slug_en"]', formRoot)?.value || $('[name="title_en"]', formRoot)?.value || 'blog-post');
  const fileName = `blog/${slugEn || `post-${Date.now()}`}/cover-${Date.now()}.webp`;

  try {
    $('#btnBlogCoverUpload').disabled = true;
    $('#btnBlogCoverUpload').textContent = 'Uploading…';

    const sourceBitmap = typeof createImageBitmap === 'function'
      ? await createImageBitmap(file)
      : await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
      });
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 2560 / sourceBitmap.width, 1600 / sourceBitmap.height);
    canvas.width = Math.round(sourceBitmap.width * ratio);
    canvas.height = Math.round(sourceBitmap.height * ratio);
    const context = canvas.getContext('2d');
    context.drawImage(sourceBitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((out) => out ? resolve(out) : reject(new Error('Failed to convert image')), 'image/webp', 0.9));

    const { error } = await client.storage.from('poi-photos').upload(fileName, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp',
    });
    if (error) throw error;

    const { data } = client.storage.from('poi-photos').getPublicUrl(fileName);
    const url = String(data?.publicUrl || '').trim();
    $('#blogFormCoverUrl').value = url;
    setCoverPreview(url);
    showToastSafe('Cover uploaded', 'success');
  } catch (error) {
    console.error('[blog-admin] Cover upload failed:', error);
    showToastSafe(error.message || 'Failed to upload cover image', 'error');
  } finally {
    $('#btnBlogCoverUpload').disabled = false;
    $('#btnBlogCoverUpload').textContent = 'Upload cover';
    if (input) input.value = '';
  }
}

async function ensureUniqueSlugs(client, blogPostId, translations) {
  const checks = window.BLOG_TRANSLATION_LANGUAGES.map((lang) => {
    const slug = String(translations?.[lang.code]?.slug || '').trim();
    return { lang: lang.code, slug };
  }).filter((entry) => entry.slug);

  for (const entry of checks) {
    let query = client
      .from('blog_post_translations')
      .select('blog_post_id')
      .eq('lang', entry.lang)
      .eq('slug', entry.slug)
      .limit(1);
    if (blogPostId) {
      query = query.neq('blog_post_id', blogPostId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message || 'Failed to validate blog slug');
    if (data?.blog_post_id) {
      throw new Error(`Slug "${entry.slug}" is already used for ${entry.lang.toUpperCase()}.`);
    }
  }
}

async function getCurrentUserId(client) {
  try {
    const { data } = await client.auth.getUser();
    return data?.user?.id || null;
  } catch (_e) {
    return null;
  }
}

function collectTranslations() {
  const formRoot = getBlogFormRoot();
  return window.BLOG_TRANSLATION_LANGUAGES.reduce((accumulator, lang) => {
    const content = getEditorContentValue(lang.code);
    accumulator[lang.code] = {
      slug: slugify($(`[name="slug_${lang.code}"]`, formRoot)?.value || ''),
      title: String($(`[name="title_${lang.code}"]`, formRoot)?.value || '').trim(),
      meta_title: String($(`[name="meta_title_${lang.code}"]`, formRoot)?.value || '').trim(),
      meta_description: String($(`[name="meta_description_${lang.code}"]`, formRoot)?.value || '').trim(),
      summary: String($(`[name="summary_${lang.code}"]`, formRoot)?.value || '').trim(),
      lead: String($(`[name="lead_${lang.code}"]`, formRoot)?.value || '').trim(),
      author_name: String($(`[name="author_name_${lang.code}"]`, formRoot)?.value || '').trim(),
      author_url: String($(`[name="author_url_${lang.code}"]`, formRoot)?.value || '').trim(),
      og_image_url: String($(`[name="og_image_url_${lang.code}"]`, formRoot)?.value || '').trim(),
      cover_alt: String($(`[name="cover_alt_${lang.code}"]`, formRoot)?.value || '').trim(),
      content_json: content.content_json,
      content_html: content.content_html,
    };
    return accumulator;
  }, {});
}

function validateTranslations(translations) {
  for (const lang of window.BLOG_TRANSLATION_LANGUAGES) {
    const translation = translations?.[lang.code];
    if (!translation?.title) {
      throw new Error(`Title (${lang.code.toUpperCase()}) is required.`);
    }
    if (!translation?.slug) {
      throw new Error(`Slug (${lang.code.toUpperCase()}) is required.`);
    }
    if (!translation?.meta_description) {
      throw new Error(`Meta description (${lang.code.toUpperCase()}) is required.`);
    }
    if (!translation?.summary) {
      throw new Error(`Summary (${lang.code.toUpperCase()}) is required.`);
    }
    if (!String(translation?.content_html || '').trim()) {
      throw new Error(`Content (${lang.code.toUpperCase()}) is required.`);
    }
  }
}

async function saveBlogForm(event) {
  event.preventDefault();

  const client = getSupabaseClient();
  if (!client) {
    showToastSafe('Database connection not available', 'error');
    return;
  }

  const translations = collectTranslations();
  try {
    validateTranslations(translations);
  } catch (error) {
    showToastSafe(error.message, 'error');
    return;
  }

  const ownerPartnerId = String($('#blogFormOwnerPartner')?.value || '').trim();
  const status = String($('#blogFormStatus')?.value || 'draft').trim();
  const submissionStatus = String($('#blogFormSubmissionStatus')?.value || 'draft').trim();
  const publishedAtRaw = String($('#blogFormPublishedAt')?.value || '').trim();
  const currentUserId = await getCurrentUserId(client);

  if (status === 'scheduled' && !publishedAtRaw) {
    showToastSafe('Scheduled posts require a publish date.', 'error');
    return;
  }

  await ensureUniqueSlugs(client, blogAdminState.editingId, translations);

  const nowIso = new Date().toISOString();
  const effectivePublishedAt = status === 'published'
    ? (publishedAtRaw ? new Date(publishedAtRaw).toISOString() : nowIso)
    : (publishedAtRaw ? new Date(publishedAtRaw).toISOString() : null);
  const reviewActive = submissionStatus === 'approved' || submissionStatus === 'rejected';
  const rejectionReason = String($('#blogFormRejectionReason')?.value || '').trim();

  const basePayload = {
    status,
    submission_status: submissionStatus,
    published_at: effectivePublishedAt,
    cover_image_url: String($('#blogFormCoverUrl')?.value || '').trim() || null,
    cover_image_alt: window.BLOG_TRANSLATION_LANGUAGES.reduce((accumulator, lang) => {
      const value = translations?.[lang.code]?.cover_alt || '';
      if (value) accumulator[lang.code] = value;
      return accumulator;
    }, {}),
    featured: Boolean($('#blogFormFeatured')?.checked),
    allow_comments: Boolean($('#blogFormAllowComments')?.checked),
    categories: parseCsvList($('#blogFormCategories')?.value || ''),
    tags: parseCsvList($('#blogFormTags')?.value || ''),
    cta_services: collectCtaRows(),
    author_profile_id: String($('#blogFormAuthorProfile')?.value || '').trim() || null,
    owner_partner_id: ownerPartnerId || null,
    reviewed_at: reviewActive ? nowIso : null,
    reviewed_by: reviewActive ? currentUserId : null,
    rejection_reason: submissionStatus === 'rejected' ? (rejectionReason || null) : null,
    updated_by: currentUserId,
  };

  try {
    const saveButton = $('#btnSaveBlogForm');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving…';
    }

    let blogPostId = blogAdminState.editingId;

    if (blogPostId) {
      const { error } = await client.from('blog_posts').update(basePayload).eq('id', blogPostId);
      if (error) throw new Error(error.message || 'Failed to update blog post');
    } else {
      const payload = {
        ...basePayload,
        created_by: currentUserId,
      };
      const { data, error } = await client
        .from('blog_posts')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw new Error(error.message || 'Failed to create blog post');
      blogPostId = data?.id || '';
    }

    const translationPayloads = window.BLOG_TRANSLATION_LANGUAGES.map((lang) => ({
      blog_post_id: blogPostId,
      lang: lang.code,
      slug: translations[lang.code].slug,
      title: translations[lang.code].title,
      meta_title: translations[lang.code].meta_title || null,
      meta_description: translations[lang.code].meta_description,
      summary: translations[lang.code].summary,
      lead: translations[lang.code].lead || null,
      author_name: translations[lang.code].author_name || null,
      author_url: translations[lang.code].author_url || null,
      content_json: translations[lang.code].content_json,
      content_html: translations[lang.code].content_html,
      og_image_url: translations[lang.code].og_image_url || null,
    }));

    const { error: translationError } = await client
      .from('blog_post_translations')
      .upsert(translationPayloads, { onConflict: 'blog_post_id,lang' });
    if (translationError) throw new Error(translationError.message || 'Failed to save blog translations');

    showToastSafe(blogAdminState.formMode === 'edit' ? 'Blog post updated' : 'Blog post created', 'success');
    closeModal();
    await loadBlogAdminData();
  } catch (error) {
    console.error('[blog-admin] Failed to save post:', error);
    showToastSafe(error.message || 'Failed to save blog post', 'error');
  } finally {
    const saveButton = $('#btnSaveBlogForm');
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Save post';
    }
  }
}

async function deleteBlogPost(postId = blogAdminState.editingId) {
  const id = String(postId || '').trim();
  if (!id) return;
  if (!window.confirm('Delete this blog post and all translations?')) return;

  const client = getSupabaseClient();
  if (!client) {
    showToastSafe('Database connection not available', 'error');
    return;
  }

  try {
    const { error } = await client.from('blog_posts').delete().eq('id', id);
    if (error) throw new Error(error.message || 'Failed to delete blog post');
    showToastSafe('Blog post deleted', 'success');
    closeModal();
    await loadBlogAdminData();
  } catch (error) {
    console.error('[blog-admin] Failed to delete post:', error);
    showToastSafe(error.message || 'Failed to delete blog post', 'error');
  }
}

async function quickUpdateSubmission(postId, submissionStatus, rejectionReason = null) {
  const client = getSupabaseClient();
  if (!client) {
    showToastSafe('Database connection not available', 'error');
    return;
  }

  const post = blogAdminState.items.find((entry) => entry.id === postId) || null;
  const currentUserId = await getCurrentUserId(client);
  const payload = {
    submission_status: submissionStatus,
    reviewed_at: new Date().toISOString(),
    reviewed_by: currentUserId,
    rejection_reason: submissionStatus === 'rejected' ? (rejectionReason || null) : null,
  };

  if (submissionStatus === 'approved' && post?.status === 'published' && !post?.published_at) {
    payload.published_at = new Date().toISOString();
  }

  try {
    const { error } = await client.from('blog_posts').update(payload).eq('id', postId);
    if (error) throw new Error(error.message || 'Failed to update blog review state');
    showToastSafe(`Blog post ${submissionStatus}`, 'success');
    await loadBlogAdminData();
  } catch (error) {
    console.error('[blog-admin] Failed to update submission state:', error);
    showToastSafe(error.message || 'Failed to update review state', 'error');
  }
}

function bindListControls() {
  $('#btnRefreshBlog')?.addEventListener('click', () => {
    void loadBlogAdminData();
  });
  $('#btnAddBlog')?.addEventListener('click', () => {
    void openBlogForm();
  });
  $('#blogAdminSearch')?.addEventListener('input', (event) => {
    blogAdminState.filterSearch = String(event.target.value || '');
    blogAdminState.currentPage = 1;
    renderTable();
  });
  $('#blogAdminStatusFilter')?.addEventListener('change', (event) => {
    blogAdminState.filterStatus = String(event.target.value || '');
    blogAdminState.currentPage = 1;
    renderTable();
  });
  $('#blogAdminSubmissionFilter')?.addEventListener('change', (event) => {
    blogAdminState.filterSubmission = String(event.target.value || '');
    blogAdminState.currentPage = 1;
    renderTable();
  });
  $('#blogAdminPartnerFilter')?.addEventListener('change', (event) => {
    const raw = String(event.target.value || '');
    blogAdminState.filterPartner = raw === '__admin__' ? '__admin__' : raw;
    blogAdminState.currentPage = 1;
    renderTable();
  });
  $('#btnClearBlogFilters')?.addEventListener('click', () => {
    blogAdminState.filterSearch = '';
    blogAdminState.filterStatus = '';
    blogAdminState.filterSubmission = '';
    blogAdminState.filterPartner = '';
    blogAdminState.currentPage = 1;
    const ids = ['blogAdminSearch', 'blogAdminStatusFilter', 'blogAdminSubmissionFilter', 'blogAdminPartnerFilter'];
    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    renderTable();
  });
  $('#blogAdminPagination')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-blog-admin-page]');
    if (!(button instanceof HTMLElement)) return;
    const nextPage = Number.parseInt(button.dataset.blogAdminPage || '', 10);
    if (!Number.isFinite(nextPage) || nextPage < 1) return;
    blogAdminState.currentPage = nextPage;
    renderTable();
  });
}

function bindModalControls() {
  $('#btnCloseBlogForm')?.addEventListener('click', closeModal);
  $('#btnCancelBlogForm')?.addEventListener('click', closeModal);
  $('#blogFormModalOverlay')?.addEventListener('click', closeModal);
  $('#blogForm')?.addEventListener('submit', (event) => {
    void saveBlogForm(event);
  });
  $('#btnDeleteBlogPost')?.addEventListener('click', () => {
    void deleteBlogPost();
  });
  $('#btnBlogAddCta')?.addEventListener('click', addCtaRow);
  $('#blogFormCtaRows')?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const removeButton = event.target.closest('[data-blog-cta-remove]');
    if (removeButton instanceof HTMLElement) {
      removeCtaRow(Number.parseInt(removeButton.dataset.blogCtaRemove || '-1', 10));
      return;
    }
  });
  $('#blogFormCtaRows')?.addEventListener('change', (event) => {
    if (!(event.target instanceof Element)) return;
    const typeSelect = event.target.closest('[data-blog-cta-type]');
    if (typeSelect instanceof HTMLSelectElement) {
      const row = typeSelect.closest('.blog-cta-row');
      if (row) {
        void populateServiceResourceOptions(row, typeSelect.value, '');
      }
    }
  });
  $('#btnBlogCoverUpload')?.addEventListener('click', () => {
    $('#blogFormCoverFile')?.click();
  });
  $('#blogFormCoverFile')?.addEventListener('change', () => {
    void handleCoverUpload();
  });
  $('#blogFormCoverUrl')?.addEventListener('input', (event) => {
    setCoverPreview(event.target.value || '');
  });
  $('#blogFormTranslations')?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-blog-editor-action]');
    if (!(button instanceof HTMLElement)) return;
    const action = String(button.dataset.blogEditorAction || '').trim();
    const lang = String(button.dataset.blogEditorLang || '').trim();
    if (!action || !lang) return;
    runEditorCommand(lang, action);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const modal = getModal();
    if (modal && !modal.hidden) {
      closeModal();
    }
  });
}

function initBlogAdmin() {
  bindListControls();
  bindModalControls();
}

window.loadBlogAdminData = () => loadBlogAdminData();
window.editBlogPost = (postId) => openBlogForm(postId);
window.approveBlogPost = (postId) => quickUpdateSubmission(postId, 'approved', null);
window.rejectBlogPost = (postId) => {
  const reason = window.prompt('Optional rejection reason', '');
  return quickUpdateSubmission(postId, 'rejected', reason);
};
window.deleteBlogPost = (postId) => deleteBlogPost(postId);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlogAdmin, { once: true });
} else {
  initBlogAdmin();
}
