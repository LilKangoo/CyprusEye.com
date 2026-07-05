const SPECIAL_OFFERS_SELECT = 'id, slug, type, winner_selection_mode, status, visibility, start_at, end_at, winner_announce_at, timezone, requires_login, requires_form, requires_manual_approval, allow_multiple_entries, max_entries_per_user, allow_bonus_points, exclude_admins, exclude_partners, public_winner_display, response_deadline_days, settings_json, created_at, updated_at, archived_at';
const SPECIAL_OFFERS_TRANSLATIONS_SELECT = 'id, offer_id, lang, title, short_description, full_description, prize_description, rules_html, faq_json, seo_title, seo_description';
const SPECIAL_OFFERS_PRIZES_SELECT = 'id, offer_id, name, description, sponsor_name, quantity, value_estimate, currency, restrictions, fulfillment_notes, sort_order';
const SPECIAL_OFFERS_LINKS_SELECT = 'id, offer_id, link_type, resource_id, url, label, description, is_primary, sort_order';
const SPECIAL_OFFERS_AUDIT_SELECT = 'id, offer_id, actor_id, action, entity_type, entity_id, old_value, new_value, metadata, created_at';

const specialOffersState = {
  initialized: false,
  loading: false,
  campaigns: [],
  editorMode: 'create',
  editingCampaignId: null,
  editorPrizes: [],
  editorLinks: [],
  removedPrizeIds: new Set(),
  removedLinkIds: new Set(),
  saving: false,
};

const SPECIAL_OFFERS_DETAIL_LANGUAGES = [
  { code: 'pl', label: 'PL', dir: 'ltr' },
  { code: 'en', label: 'EN', dir: 'ltr' },
  { code: 'he', label: 'HE', dir: 'rtl' },
];

const SPECIAL_OFFERS_TYPES = ['contest', 'giveaway', 'weighted_draw', 'partner_promo', 'coupon_promo', 'landing_only'];
const SPECIAL_OFFERS_WINNER_MODES = ['manual_selection', 'weighted_draw', 'none'];
const SPECIAL_OFFERS_LINK_TYPES = ['cars', 'trips', 'hotels', 'transport', 'shop', 'coupons', 'vip', 'custom'];
const SPECIAL_OFFERS_DEFAULT_SETTINGS = {
  requires_login: true,
  requires_form: true,
  requires_manual_approval: true,
  allow_multiple_entries: false,
  max_entries_per_user: 1,
  allow_bonus_points: true,
  exclude_admins: true,
  exclude_partners: false,
  public_winner_display: false,
  response_deadline_days: 7,
};

function getSupabaseClient() {
  if (typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }
  if (window.sb) return window.sb;
  if (window.__SB__) return window.__SB__;
  return null;
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupByOfferId(rows) {
  return toArray(rows).reduce((acc, row) => {
    const offerId = row?.offer_id;
    if (!offerId) return acc;
    if (!acc[offerId]) acc[offerId] = [];
    acc[offerId].push(row);
    return acc;
  }, {});
}

function titleCase(value) {
  const normalized = String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Nicosia',
  }).format(date);
}

function formatCampaignTitle(campaign) {
  const translation = getPrimaryTranslation(campaign);
  return translation?.title || campaign.slug || 'Untitled campaign';
}

function getPrimaryTranslation(campaign) {
  return getTranslationByLanguage(campaign, 'pl')
    || getTranslationByLanguage(campaign, 'en')
    || getTranslationByLanguage(campaign, 'he')
    || null;
}

function getTranslationByLanguage(campaign, lang) {
  const normalizedLang = String(lang || '').trim().toLowerCase();
  return toArray(campaign?.translations).find((row) => String(row?.lang || '').trim().toLowerCase() === normalizedLang) || null;
}

function countByStatus(campaigns, status) {
  return campaigns.filter((campaign) => campaign.status === status).length;
}

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function setStat(name, value) {
  const element = document.querySelector(`[data-special-offers-stat="${name}"]`);
  if (element) element.textContent = String(value);
}

function setHeaderStatus(label, tone = 'pending') {
  const chip = $('.special-offers-header-chip');
  if (!chip) return;
  chip.dataset.status = tone;
  chip.innerHTML = '<span class="special-offers-chip-dot" aria-hidden="true"></span>' + escapeHtml(label);
}

function setLoadingState(isLoading) {
  setHidden($('#specialOffersLoadingState'), !isLoading);
}

function setErrorState(message) {
  const errorState = $('#specialOffersErrorState');
  if (!errorState) return;
  if (!message) {
    errorState.hidden = true;
    errorState.textContent = 'Unable to load Special Offers data.';
    return;
  }
  errorState.textContent = message;
  errorState.hidden = false;
}

function renderStats(campaigns) {
  setStat('active', countByStatus(campaigns, 'active'));
  setStat('draft', countByStatus(campaigns, 'draft'));
  setStat('entries', 0);
  setStat('winners', 0);
}

function renderStatusChip(value, type = 'status') {
  const normalized = String(value || 'unknown').toLowerCase();
  const className = `special-offer-status-chip special-offer-status-chip--${escapeHtml(normalized)}`;
  return `<span class="${className}" data-chip-type="${escapeHtml(type)}">${escapeHtml(titleCase(normalized))}</span>`;
}

function renderCampaignCard(campaign) {
  const title = formatCampaignTitle(campaign);
  const prizeCount = campaign.prizes.length;
  const linkCount = campaign.links.length;
  const primaryLinkCount = campaign.links.filter((link) => Boolean(link.is_primary)).length;
  const dateRange = `${formatDate(campaign.start_at)} - ${formatDate(campaign.end_at)}`;
  const winnerDate = formatDate(campaign.winner_announce_at);
  const canEdit = isDraftPrivateCampaign(campaign);

  return `
    <article class="special-offer-campaign-card" data-special-offer-card="${escapeHtml(campaign.id)}">
      <div class="special-offer-campaign-card__top">
        <div>
          <h4 class="special-offer-campaign-card__title">${escapeHtml(title)}</h4>
          <div class="special-offer-campaign-card__slug">${escapeHtml(campaign.slug)}</div>
        </div>
        <div class="special-offer-campaign-card__chips">
          ${renderStatusChip(campaign.status)}
          ${renderStatusChip(campaign.visibility, 'visibility')}
        </div>
      </div>
      <div class="special-offer-campaign-card__chips">
        <span class="special-offer-pill">${escapeHtml(titleCase(campaign.type))}</span>
        <span class="special-offer-pill">${escapeHtml(titleCase(campaign.winner_selection_mode))}</span>
      </div>
      <div class="special-offer-campaign-card__meta">
        <span><strong>Dates:</strong> ${escapeHtml(dateRange)}</span>
        <span><strong>Winner announcement:</strong> ${escapeHtml(winnerDate)}</span>
      </div>
      <div class="special-offer-campaign-card__counts">
        <span>${prizeCount} ${prizeCount === 1 ? 'prize' : 'prizes'}</span>
        <span>${linkCount} linked services</span>
        <span>${primaryLinkCount} primary CTA</span>
      </div>
      <div class="special-offer-campaign-card__actions">
        <button class="btn-secondary btn-small" type="button" data-special-offers-view="${escapeHtml(campaign.id)}">View details</button>
        <button
          class="btn-primary btn-small"
          type="button"
          data-special-offers-edit="${escapeHtml(campaign.id)}"
          ${canEdit ? '' : 'disabled title="Editing for published/locked campaigns will be available in a later stage."'}
        >Edit</button>
      </div>
    </article>
  `;
}

function renderCampaigns(campaigns) {
  const emptyState = $('#specialOffersEmptyState');
  const campaignsSection = $('#specialOffersCampaigns');
  const grid = $('#specialOffersCampaignGrid');

  if (!campaigns.length) {
    setHidden(emptyState, false);
    setHidden(campaignsSection, true);
    if (grid) grid.innerHTML = '';
    setHeaderStatus('No campaigns yet', 'empty');
    return;
  }

  setHidden(emptyState, true);
  setHidden(campaignsSection, false);
  setHeaderStatus('Draft CRUD enabled', 'ready');
  if (grid) {
    grid.innerHTML = campaigns.map(renderCampaignCard).join('');
  }
}

function normalizeCampaigns(offers, translationsByOffer, prizesByOffer, linksByOffer) {
  return toArray(offers).map((offer) => ({
    ...offer,
    translations: toArray(translationsByOffer[offer.id]),
    prizes: toArray(prizesByOffer[offer.id]).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    links: toArray(linksByOffer[offer.id]).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    audit_log: [],
  }));
}

async function loadSpecialOffersReadOnly() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is not available.');
  }

  const { data: offers, error: offersError } = await client
    .from('special_offers')
    .select(SPECIAL_OFFERS_SELECT)
    .order('start_at', { ascending: false });

  if (offersError) throw offersError;

  const offerIds = toArray(offers).map((offer) => offer.id).filter(Boolean);
  if (!offerIds.length) {
    return [];
  }

  const [translationsResult, prizesResult, linksResult, auditResult] = await Promise.all([
    client
      .from('special_offer_translations')
      .select(SPECIAL_OFFERS_TRANSLATIONS_SELECT)
      .in('offer_id', offerIds),
    client
      .from('special_offer_prizes')
      .select(SPECIAL_OFFERS_PRIZES_SELECT)
      .in('offer_id', offerIds),
    client
      .from('special_offer_links')
      .select(SPECIAL_OFFERS_LINKS_SELECT)
      .in('offer_id', offerIds),
    client
      .from('special_offer_audit_log')
      .select(SPECIAL_OFFERS_AUDIT_SELECT)
      .in('offer_id', offerIds)
      .order('created_at', { ascending: false }),
  ]);

  if (translationsResult.error) throw translationsResult.error;
  if (prizesResult.error) throw prizesResult.error;
  if (linksResult.error) throw linksResult.error;
  if (auditResult.error) throw auditResult.error;

  const campaigns = normalizeCampaigns(
    offers,
    groupByOfferId(translationsResult.data),
    groupByOfferId(prizesResult.data),
    groupByOfferId(linksResult.data),
  );
  const auditByOffer = groupByOfferId(auditResult.data);
  return campaigns.map((campaign) => ({
    ...campaign,
    audit_log: toArray(auditByOffer[campaign.id]),
  }));
}

function renderDetailRows(rows) {
  return `
    <div class="special-offers-detail-list">
      ${rows.map(([label, value]) => `
        <div class="special-offers-detail-row">
          <span>${escapeHtml(label)}</span>
          <span>${escapeHtml(formatDetailValue(value))}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function formatDetailValue(value) {
  if (value === null || value === undefined) return 'Not set';
  const text = String(value).trim();
  return text || 'Not set';
}

function formatDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeLocal(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isDraftPrivateCampaign(campaign) {
  return campaign?.status === 'draft' && campaign?.visibility === 'private';
}

function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return fallback;
  }
}

function buildCampaignSnapshot(campaign) {
  if (!campaign) return {};
  return {
    id: campaign.id,
    slug: campaign.slug,
    status: campaign.status,
    visibility: campaign.visibility,
    type: campaign.type,
    winner_selection_mode: campaign.winner_selection_mode,
    start_at: campaign.start_at || null,
    end_at: campaign.end_at || null,
    winner_announce_at: campaign.winner_announce_at || null,
    translations: toArray(campaign.translations).map((item) => ({ lang: item.lang, title: item.title || '' })),
    prizes_count: toArray(campaign.prizes).length,
    links_count: toArray(campaign.links).length,
  };
}

function getCurrentCampaign() {
  return specialOffersState.campaigns.find((item) => item.id === specialOffersState.editingCampaignId) || null;
}

function getTempId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEditorModal() {
  return $('#specialOffersEditorModal');
}

function setEditorMessage(message = '', tone = 'info') {
  const node = $('#specialOffersEditorMessage');
  if (!node) return;
  node.hidden = !message;
  node.dataset.tone = tone;
  node.textContent = message;
}

function setEditorSaving(isSaving) {
  specialOffersState.saving = isSaving;
  const saveButton = $('#specialOffersEditorSave');
  const archiveButton = $('#specialOffersEditorArchive');
  if (saveButton) {
    saveButton.disabled = isSaving;
    saveButton.textContent = isSaving ? 'Saving...' : 'Save draft';
  }
  if (archiveButton) archiveButton.disabled = isSaving;
}

function sanitizeRulesHtml(value) {
  const source = String(value || '').trim();
  if (!source) return '';

  const template = document.createElement('template');
  template.innerHTML = source;

  template.content.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, input, button').forEach((node) => {
    node.remove();
  });

  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const valueText = String(attribute.value || '').trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && valueText.startsWith('javascript:'))) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
}

function normalizeFaqItems(value) {
  return toArray(value)
    .map((item) => ({
      question: formatDetailValue(item?.question),
      answer: formatDetailValue(item?.answer),
    }))
    .filter((item) => item.question !== 'Not set' || item.answer !== 'Not set');
}

function renderFaqItems(value) {
  const items = normalizeFaqItems(value);
  if (!items.length) return '<p class="special-offers-empty-copy">No FAQ items</p>';
  return `
    <div class="special-offers-faq-list">
      ${items.map((item) => `
        <article class="special-offers-faq-item">
          <h5>${escapeHtml(item.question)}</h5>
          <p>${escapeHtml(item.answer)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderRulesHtml(value) {
  const html = sanitizeRulesHtml(value);
  if (!html) return '<p class="special-offers-empty-copy">Not set</p>';
  return `<div class="special-offers-rules-html">${html}</div>`;
}

function renderTranslationPanel(campaign, language, isActive) {
  const translation = getTranslationByLanguage(campaign, language.code);
  const dir = language.dir;

  if (!translation) {
    return `
      <section
        class="special-offers-translation-panel"
        id="special-offers-lang-panel-${escapeHtml(language.code)}"
        data-special-offers-lang-panel="${escapeHtml(language.code)}"
        role="tabpanel"
        aria-labelledby="special-offers-lang-tab-${escapeHtml(language.code)}"
        dir="${escapeHtml(dir)}"
        ${isActive ? '' : 'hidden'}
      >
        <p class="special-offers-empty-copy">Translation not available yet</p>
      </section>
    `;
  }

  return `
    <section
      class="special-offers-translation-panel"
      id="special-offers-lang-panel-${escapeHtml(language.code)}"
      data-special-offers-lang-panel="${escapeHtml(language.code)}"
      role="tabpanel"
      aria-labelledby="special-offers-lang-tab-${escapeHtml(language.code)}"
      dir="${escapeHtml(dir)}"
      ${isActive ? '' : 'hidden'}
    >
      ${renderDetailRows([
        ['Title', translation.title],
        ['Short description', translation.short_description],
        ['Full description', translation.full_description],
        ['Prize description', translation.prize_description],
        ['SEO title', translation.seo_title],
        ['SEO description', translation.seo_description],
      ])}
      <div class="special-offers-content-block">
        <h5>Rules</h5>
        ${renderRulesHtml(translation.rules_html)}
      </div>
      <div class="special-offers-content-block">
        <h5>FAQ</h5>
        ${renderFaqItems(translation.faq_json)}
      </div>
    </section>
  `;
}

function renderTranslationsTabs(campaign) {
  return `
    <div class="special-offers-translation-tabs" role="tablist" aria-label="Campaign translations">
      ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => `
        <button
          class="special-offers-translation-tab${index === 0 ? ' is-active' : ''}"
          type="button"
          id="special-offers-lang-tab-${escapeHtml(language.code)}"
          data-special-offers-lang-tab="${escapeHtml(language.code)}"
          role="tab"
          aria-selected="${index === 0 ? 'true' : 'false'}"
          aria-controls="special-offers-lang-panel-${escapeHtml(language.code)}"
        >
          ${escapeHtml(language.label)}
        </button>
      `).join('')}
    </div>
    <div class="special-offers-translation-panels">
      ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => renderTranslationPanel(campaign, language, index === 0)).join('')}
    </div>
  `;
}

function renderSettingsSummary(settings) {
  const mandatory = toArray(settings?.mandatory_conditions);
  const extra = toArray(settings?.extra_manual_activity);
  const organizers = toArray(settings?.organizers).join(', ');
  const manualVerification = settings?.social_verification?.mode === 'manual' ? 'Manual social verification' : 'Not set';
  const socialIntegrations = settings?.social_verification?.automatic_integrations === false
    ? 'No automatic social integrations'
    : 'Not set';

  return `
    <div class="special-offers-detail-list">
      ${renderDetailRows([
        ['Partner', settings?.partner || 'Not set'],
        ['Organizers', organizers || 'Not set'],
        ['Social verification', manualVerification],
        ['Social integrations', socialIntegrations],
      ])}
      ${mandatory.length ? `
        <h4>Required conditions</h4>
        <ul class="special-offers-settings-list">
          ${mandatory.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      ` : ''}
      ${extra.length ? `
        <h4>Extra/manual activity</h4>
        <ul class="special-offers-settings-list">
          ${extra.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

function renderPrizes(prizes) {
  if (!prizes.length) return '<p class="special-offers-empty-copy">No prizes configured.</p>';
  return prizes.map((prize) => renderDetailRows([
    ['Name', prize.name],
    ['Sponsor', prize.sponsor_name],
    ['Quantity', prize.quantity],
    ['Description', prize.description],
    ['Restrictions', prize.restrictions],
  ])).join('');
}

function renderLinkedServices(links) {
  if (!links.length) return '<p class="special-offers-empty-copy">No linked services configured.</p>';
  return `
    <div class="special-offers-linked-service-list">
      ${links.map((link) => `
        <div class="special-offers-linked-service">
          <div class="special-offer-campaign-card__chips">
            <span class="special-offer-link-chip">${escapeHtml(titleCase(link.link_type))}</span>
            <span class="special-offer-pill">${link.resource_id ? 'Resource ID' : 'URL-only'}</span>
            ${link.is_primary ? '<span class="special-offer-pill">Primary CTA</span>' : ''}
          </div>
          ${renderDetailRows([
            ['Label', link.label],
            ['URL', link.url],
            ['Resource ID', link.resource_id || 'None'],
            ['Description', link.description],
          ])}
        </div>
      `).join('')}
    </div>
  `;
}

function renderAuditLog(rows) {
  const items = toArray(rows).slice(0, 8);
  if (!items.length) return '<p class="special-offers-empty-copy">No audit events yet.</p>';
  return `
    <div class="special-offers-linked-service-list">
      ${items.map((row) => `
        <div class="special-offers-linked-service">
          ${renderDetailRows([
            ['Action', row.action],
            ['Actor', row.actor_id || 'Not set'],
            ['Created', row.created_at ? new Date(row.created_at).toLocaleString('pl-PL', { timeZone: 'Asia/Nicosia' }) : 'Not set'],
            ['Source', row.metadata?.source || 'Not set'],
          ])}
        </div>
      `).join('')}
    </div>
  `;
}

function renderOptionList(values, selectedValue, labels = {}) {
  return values.map((value) => `
    <option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(labels[value] || titleCase(value))}</option>
  `).join('');
}

function getEditorTranslation(campaign, lang) {
  return getTranslationByLanguage(campaign, lang) || { lang, faq_json: [] };
}

function renderHelp(text) {
  return `<span class="special-offer-help" title="${escapeHtml(text)}" aria-label="${escapeHtml(text)}">?</span>`;
}

function normalizeFaqEditorItems(value) {
  return toArray(value)
    .map((item) => ({
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
    }))
    .filter((item) => item.question || item.answer);
}

function renderFaqBuilder(lang, items, dir) {
  const rows = normalizeFaqEditorItems(items);
  return `
    <div class="special-offer-builder" data-faq-builder="${escapeHtml(lang)}" dir="${escapeHtml(dir)}">
      <div class="special-offer-editor-section-head">
        <h5>FAQ builder ${renderHelp('Add public FAQ items for this language. Question and answer are required when an item exists.')}</h5>
        <button class="btn-secondary btn-small" type="button" data-special-offers-add-faq="${escapeHtml(lang)}">Add FAQ item</button>
      </div>
      <div class="special-offer-builder-list" data-faq-list="${escapeHtml(lang)}">
        ${rows.length ? rows.map((item, index) => renderFaqEditorItem(lang, item, index, dir)).join('') : '<p class="special-offers-empty-copy">No FAQ items yet</p>'}
      </div>
      <details class="special-offer-advanced-source">
        <summary>Advanced JSON preview</summary>
        <pre data-faq-json-preview="${escapeHtml(lang)}">${escapeHtml(JSON.stringify(rows, null, 2))}</pre>
      </details>
    </div>
  `;
}

function renderFaqEditorItem(lang, item = {}, index = 0, dir = 'ltr') {
  return `
    <article class="special-offer-builder-item" data-faq-item="${escapeHtml(lang)}">
      <div class="special-offer-editor-item__header">
        <strong>FAQ ${index + 1}</strong>
        <button class="btn-secondary btn-small" type="button" data-special-offers-remove-faq>Remove</button>
      </div>
      <label>Question
        <input data-faq-field="question" value="${escapeHtml(item.question || '')}" dir="${escapeHtml(dir)}" />
      </label>
      <label>Answer
        <textarea data-faq-field="answer" rows="2" dir="${escapeHtml(dir)}">${escapeHtml(item.answer || '')}</textarea>
      </label>
    </article>
  `;
}

function extractTextFromNode(node) {
  return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function parseRulesHtmlToSections(value) {
  const source = String(value || '').trim();
  if (!source) return { sections: [], source: '', parsed: true };

  const template = document.createElement('template');
  template.innerHTML = source;
  const sections = [];
  const sectionNodes = Array.from(template.content.querySelectorAll('section'));

  if (sectionNodes.length) {
    sectionNodes.forEach((section) => {
      const title = extractTextFromNode(section.querySelector('h1,h2,h3,h4,strong')) || 'Rules';
      let bullets = Array.from(section.querySelectorAll('li')).map(extractTextFromNode).filter(Boolean);
      if (!bullets.length) {
        bullets = Array.from(section.querySelectorAll('p')).map(extractTextFromNode).filter(Boolean);
      }
      if (title || bullets.length) sections.push({ title, bullets });
    });
  } else {
    const titleNode = template.content.querySelector('h1,h2,h3,h4,strong');
    const title = extractTextFromNode(titleNode) || 'Rules';
    let bullets = Array.from(template.content.querySelectorAll('li')).map(extractTextFromNode).filter(Boolean);
    if (!bullets.length) {
      bullets = Array.from(template.content.querySelectorAll('p')).map(extractTextFromNode).filter(Boolean);
    }
    if (title || bullets.length) sections.push({ title, bullets });
  }

  return { sections, source, parsed: Boolean(sections.length) };
}

function renderRulesBuilder(lang, rulesHtml, dir) {
  const parsed = parseRulesHtmlToSections(rulesHtml);
  return `
    <div class="special-offer-builder" data-rules-builder="${escapeHtml(lang)}" dir="${escapeHtml(dir)}" data-rules-source-preserve="${parsed.parsed ? '0' : '1'}">
      <div class="special-offer-editor-section-head">
        <h5>Rules builder ${renderHelp('Build rule sections and bullet points. The editor generates rules_html on save.')}</h5>
        <button class="btn-secondary btn-small" type="button" data-special-offers-add-rule-section="${escapeHtml(lang)}">Add rule section</button>
      </div>
      <div class="special-offer-builder-list" data-rules-list="${escapeHtml(lang)}">
        ${parsed.sections.length ? parsed.sections.map((section, index) => renderRuleSection(lang, section, index, dir)).join('') : '<p class="special-offers-empty-copy">No rule sections yet</p>'}
      </div>
      <details class="special-offer-advanced-source">
        <summary>Advanced HTML source</summary>
        <p class="special-offer-editor-muted">Use this only to inspect or preserve legacy HTML. The builder output is used when sections exist.</p>
        <textarea name="${escapeHtml(lang)}_rules_html_source" rows="5" dir="${escapeHtml(dir)}">${escapeHtml(parsed.source)}</textarea>
        <pre data-rules-html-preview="${escapeHtml(lang)}">${escapeHtml(generateRulesHtml(parsed.sections))}</pre>
      </details>
    </div>
  `;
}

function renderRuleSection(lang, section = {}, index = 0, dir = 'ltr') {
  const bullets = toArray(section.bullets).filter((item) => String(item || '').trim());
  return `
    <article class="special-offer-builder-item" data-rule-section="${escapeHtml(lang)}">
      <div class="special-offer-editor-item__header">
        <strong>Rule section ${index + 1}</strong>
        <button class="btn-secondary btn-small" type="button" data-special-offers-remove-rule-section>Remove section</button>
      </div>
      <label>Section title
        <input data-rule-field="title" value="${escapeHtml(section.title || '')}" dir="${escapeHtml(dir)}" />
      </label>
      <div class="special-offer-builder-list special-offer-builder-list--nested" data-rule-bullets>
        ${bullets.length ? bullets.map((bullet) => renderRuleBullet(bullet, dir)).join('') : '<p class="special-offers-empty-copy">No bullet items yet</p>'}
      </div>
      <button class="btn-secondary btn-small" type="button" data-special-offers-add-rule-bullet>Add bullet</button>
    </article>
  `;
}

function renderRuleBullet(value = '', dir = 'ltr') {
  return `
    <div class="special-offer-rule-bullet" data-rule-bullet>
      <input data-rule-field="bullet" value="${escapeHtml(value)}" dir="${escapeHtml(dir)}" />
      <button class="btn-secondary btn-small" type="button" data-special-offers-remove-rule-bullet>Remove bullet</button>
    </div>
  `;
}

function generateRulesHtml(sections) {
  return toArray(sections)
    .filter((section) => String(section.title || '').trim() || toArray(section.bullets).some((bullet) => String(bullet || '').trim()))
    .map((section) => {
      const title = String(section.title || '').trim();
      const bullets = toArray(section.bullets).map((bullet) => String(bullet || '').trim()).filter(Boolean);
      return `<section>${title ? `<h3>${escapeHtml(title)}</h3>` : ''}${bullets.length ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}</section>`;
    })
    .join('');
}

function renderTranslationEditor(campaign, language, isActive) {
  const translation = getEditorTranslation(campaign, language.code);
  const dir = language.dir;
  return `
    <section
      class="special-offer-editor-lang-panel"
      data-special-offers-editor-lang-panel="${escapeHtml(language.code)}"
      dir="${escapeHtml(dir)}"
      ${isActive ? '' : 'hidden'}
    >
      <label>Title${language.code === 'pl' ? ' *' : ''}
        <input name="${escapeHtml(language.code)}_title" value="${escapeHtml(translation.title || '')}" dir="${escapeHtml(dir)}" />
      </label>
      <label>Short description
        <textarea name="${escapeHtml(language.code)}_short_description" rows="2" dir="${escapeHtml(dir)}">${escapeHtml(translation.short_description || '')}</textarea>
      </label>
      <label>Full description
        <textarea name="${escapeHtml(language.code)}_full_description" rows="4" dir="${escapeHtml(dir)}">${escapeHtml(translation.full_description || '')}</textarea>
      </label>
      <label>Prize description
        <textarea name="${escapeHtml(language.code)}_prize_description" rows="3" dir="${escapeHtml(dir)}">${escapeHtml(translation.prize_description || '')}</textarea>
      </label>
      ${renderRulesBuilder(language.code, translation.rules_html || '', dir)}
      ${renderFaqBuilder(language.code, translation.faq_json || [], dir)}
      <label>SEO title
        <input name="${escapeHtml(language.code)}_seo_title" value="${escapeHtml(translation.seo_title || '')}" dir="${escapeHtml(dir)}" />
      </label>
      <label>SEO description
        <textarea name="${escapeHtml(language.code)}_seo_description" rows="2" dir="${escapeHtml(dir)}">${escapeHtml(translation.seo_description || '')}</textarea>
      </label>
    </section>
  `;
}

function renderPrizeEditorList() {
  const host = $('#specialOfferEditorPrizes');
  if (!host) return;
  if (!specialOffersState.editorPrizes.length) {
    host.innerHTML = '<p class="special-offers-empty-copy">No prizes yet.</p>';
    return;
  }
  host.innerHTML = specialOffersState.editorPrizes.map((prize, index) => `
    <article class="special-offer-editor-item" data-special-offers-prize="${escapeHtml(prize.client_id)}">
      <div class="special-offer-editor-item__header">
        <strong>Prize ${index + 1}</strong>
        <button class="btn-secondary btn-small" type="button" data-special-offers-remove-prize="${escapeHtml(prize.client_id)}">Remove</button>
      </div>
      <p class="special-offer-editor-muted">These are global/admin operational details. Language-specific public prize copy is edited in Content PL / EN / HE -> Prize description.</p>
      <div class="special-offer-editor-grid">
        <label>Name *
          <input data-prize-field="name" value="${escapeHtml(prize.name || '')}" />
        </label>
        <label>Sponsor
          <input data-prize-field="sponsor_name" value="${escapeHtml(prize.sponsor_name || '')}" />
        </label>
        <label>Quantity *
          <input data-prize-field="quantity" type="number" min="1" step="1" value="${escapeHtml(prize.quantity || 1)}" />
        </label>
        <label>Value estimate
          <input data-prize-field="value_estimate" type="number" min="0" step="0.01" value="${escapeHtml(prize.value_estimate || '')}" />
        </label>
        <label>Currency
          <input data-prize-field="currency" value="${escapeHtml(prize.currency || 'EUR')}" />
        </label>
        <label>Sort order
          <input data-prize-field="sort_order" type="number" step="1" value="${escapeHtml(prize.sort_order || index)}" />
        </label>
        <label class="special-offer-editor-field--wide">Description
          <textarea data-prize-field="description" rows="2">${escapeHtml(prize.description || '')}</textarea>
        </label>
        <label class="special-offer-editor-field--wide">Restrictions
          <textarea data-prize-field="restrictions" rows="2">${escapeHtml(prize.restrictions || '')}</textarea>
        </label>
        <label class="special-offer-editor-field--wide">Fulfillment notes
          <textarea data-prize-field="fulfillment_notes" rows="2">${escapeHtml(prize.fulfillment_notes || '')}</textarea>
        </label>
      </div>
    </article>
  `).join('');
}

function renderLinkEditorList() {
  const host = $('#specialOfferEditorLinks');
  if (!host) return;
  if (!specialOffersState.editorLinks.length) {
    host.innerHTML = '<p class="special-offers-empty-copy">No linked services yet.</p>';
    return;
  }
  host.innerHTML = specialOffersState.editorLinks.map((link, index) => `
    <article class="special-offer-editor-item" data-special-offers-link="${escapeHtml(link.client_id)}">
      <div class="special-offer-editor-item__header">
        <strong>Link ${index + 1}</strong>
        <button class="btn-secondary btn-small" type="button" data-special-offers-remove-link="${escapeHtml(link.client_id)}">Remove</button>
      </div>
      <div class="special-offer-editor-grid">
        <label>Type *
          <select data-link-field="link_type">
            ${renderOptionList(SPECIAL_OFFERS_LINK_TYPES, link.link_type || 'custom')}
          </select>
        </label>
        <label>Label *
          <input data-link-field="label" value="${escapeHtml(link.label || '')}" />
        </label>
        <label class="special-offer-editor-field--wide">URL *
          <input data-link-field="url" value="${escapeHtml(link.url || '')}" placeholder="/car.html?lang=pl" />
        </label>
        <label>Sort order
          <input data-link-field="sort_order" type="number" step="1" value="${escapeHtml(link.sort_order || index)}" />
        </label>
        <label class="special-offer-editor-check">
          <input data-link-field="is_primary" type="checkbox" ${link.is_primary ? 'checked' : ''} />
          Primary CTA
        </label>
        <label class="special-offer-editor-field--wide">Description
          <textarea data-link-field="description" rows="2">${escapeHtml(link.description || '')}</textarea>
        </label>
      </div>
      <p class="special-offer-editor-muted">URL-only in this stage. Resource ID stays empty.</p>
      <p class="special-offer-editor-muted">Language-specific labels and URLs require the next schema stage; the preview below is not saved separately.</p>
      <div class="special-offer-url-preview" data-link-url-preview>${renderLanguageUrlPreview(link.url || '')}</div>
    </article>
  `).join('');
}

function renderLanguageUrlPreview(url) {
  const source = String(url || '').trim();
  if (!source) return '<span>No URL preview yet.</span>';
  const makeUrl = (lang) => {
    if (/([?&])lang=/.test(source)) return source.replace(/([?&])lang=[^&]*/i, `$1lang=${lang}`);
    if (source.includes('?')) return `${source}&lang=${lang}`;
    return `${source}?lang=${lang}`;
  };
  return ['pl', 'en', 'he'].map((lang) => `<span>${lang.toUpperCase()}: ${escapeHtml(makeUrl(lang))}</span>`).join('');
}

function getCampaignEditorDefaults(campaign = null) {
  return {
    slug: campaign?.slug || '',
    type: campaign?.type || 'contest',
    winner_selection_mode: campaign?.winner_selection_mode || 'manual_selection',
    status: campaign?.status === 'archived' ? 'archived' : 'draft',
    visibility: 'private',
    start_at: formatDateTimeLocal(campaign?.start_at),
    end_at: formatDateTimeLocal(campaign?.end_at),
    winner_announce_at: formatDateTimeLocal(campaign?.winner_announce_at),
    timezone: campaign?.timezone || 'Asia/Nicosia',
    requires_login: campaign?.requires_login ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.requires_login,
    requires_form: campaign?.requires_form ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.requires_form,
    requires_manual_approval: campaign?.requires_manual_approval ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.requires_manual_approval,
    allow_multiple_entries: campaign?.allow_multiple_entries ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.allow_multiple_entries,
    max_entries_per_user: campaign?.max_entries_per_user ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.max_entries_per_user,
    allow_bonus_points: campaign?.allow_bonus_points ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.allow_bonus_points,
    exclude_admins: campaign?.exclude_admins ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.exclude_admins,
    exclude_partners: campaign?.exclude_partners ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.exclude_partners,
    public_winner_display: campaign?.public_winner_display ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.public_winner_display,
    response_deadline_days: campaign?.response_deadline_days ?? SPECIAL_OFFERS_DEFAULT_SETTINGS.response_deadline_days,
    settings_json: cloneJson(campaign?.settings_json, {}),
  };
}

function renderEditorForm(campaign = null) {
  const defaults = getCampaignEditorDefaults(campaign);
  return `
    <form class="special-offer-editor" id="specialOfferEditorForm" novalidate>
      <div class="special-offer-editor-tabs" role="tablist" aria-label="Special Offers editor sections">
        ${[
          ['basic', 'Basic settings'],
          ['dates', 'Dates & visibility'],
          ['content', 'Content PL / EN / HE'],
          ['prize', 'Prize'],
          ['links', 'Linked services'],
          ['rules', 'Rules/settings'],
          ['review', 'Review & save'],
        ].map(([key, label], index) => `
          <button class="special-offer-editor-tab${index === 0 ? ' is-active' : ''}" type="button" data-special-offers-editor-tab="${key}">${label}</button>
        `).join('')}
      </div>
      <div class="special-offer-editor-panels">
        <section class="special-offer-editor-section" data-special-offers-editor-panel="basic">
          <p class="special-offer-editor-muted">${renderHelp('Type controls the campaign category. Winner mode controls how winners will be selected later. Status is draft or archived only here; visibility is private only.') } Basic settings define internal campaign identity. Publishing is not available in this stage.</p>
          <div class="special-offer-editor-grid">
            <label>Slug *
              <input name="slug" value="${escapeHtml(defaults.slug)}" placeholder="summer-giveaway-2026" required />
            </label>
            <label>Type *
              <select name="type">${renderOptionList(SPECIAL_OFFERS_TYPES, defaults.type)}</select>
            </label>
            <label>Winner mode *
              <select name="winner_selection_mode">${renderOptionList(SPECIAL_OFFERS_WINNER_MODES, defaults.winner_selection_mode)}</select>
            </label>
            <label>Status
              <select name="status">
                <option value="draft" ${defaults.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="archived" ${defaults.status === 'archived' ? 'selected' : ''}>Archived</option>
                <option value="active" disabled>Active - Available in publish stage</option>
              </select>
            </label>
            <label>Visibility
              <select name="visibility">
                <option value="private" selected>Private</option>
                <option value="public" disabled>Public - Available in publish stage</option>
                <option value="unlisted" disabled>Unlisted - Available in publish stage</option>
              </select>
            </label>
          </div>
          <p class="special-offer-editor-muted">This stage only saves draft/private campaigns. Publishing is not available.</p>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="dates" hidden>
          <p class="special-offer-editor-muted">${renderHelp('Start/end dates describe campaign timing. Winner announce should be after the end date. Timezone defaults to Asia/Nicosia.') } Dates are saved for planning and internal review; they do not publish the campaign.</p>
          <div class="special-offer-editor-grid">
            <label>Start at
              <input name="start_at" type="datetime-local" value="${escapeHtml(defaults.start_at)}" />
            </label>
            <label>End at
              <input name="end_at" type="datetime-local" value="${escapeHtml(defaults.end_at)}" />
            </label>
            <label>Winner announce at
              <input name="winner_announce_at" type="datetime-local" value="${escapeHtml(defaults.winner_announce_at)}" />
            </label>
            <label>Timezone *
              <input name="timezone" value="${escapeHtml(defaults.timezone)}" required />
            </label>
          </div>
          <p class="special-offer-editor-muted">Visibility remains private in this stage.</p>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="content" hidden>
          <p class="special-offer-editor-muted">${renderHelp('These PL/EN/HE tabs are the campaign content translations. Prize description here is the language-specific public prize copy for this stage.') } Edit campaign copy, FAQ items and rule sections per language.</p>
          <div class="special-offers-translation-tabs" role="tablist" aria-label="Editor translation languages">
            ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => `
              <button class="special-offers-translation-tab${index === 0 ? ' is-active' : ''}" type="button" data-special-offers-editor-lang-tab="${escapeHtml(language.code)}">${escapeHtml(language.label)}</button>
            `).join('')}
          </div>
          ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => renderTranslationEditor(campaign, language, index === 0)).join('')}
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="prize" hidden>
          <div class="special-offer-editor-section-head">
            <h4>Prize operational details ${renderHelp('Prize fields here are global/admin operational fields. Language-specific prize translations require a future schema stage.')}</h4>
            <button class="btn-secondary btn-small" type="button" data-special-offers-add-prize>Add prize</button>
          </div>
          <p class="special-offer-editor-muted">These fields are global/admin operational details. Language-specific public prize copy is edited in Content PL / EN / HE -> Prize description.</p>
          <div class="special-offer-editor-list" id="specialOfferEditorPrizes"></div>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="links" hidden>
          <div class="special-offer-editor-section-head">
            <h4>URL-only linked services ${renderHelp('This stage supports URL-only links. Resource ID picker and language-specific label/url fields require a future schema stage.')}</h4>
            <button class="btn-secondary btn-small" type="button" data-special-offers-add-link>Add URL-only link</button>
          </div>
          <p class="special-offer-editor-muted">Resource ID picker is disabled in this stage. Language-specific labels/URLs require the next schema stage; URL previews are informational only and are not saved separately.</p>
          <div class="special-offer-editor-list" id="specialOfferEditorLinks"></div>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="rules" hidden>
          <p class="special-offer-editor-muted">${renderHelp('These settings control future campaign behavior while keeping the campaign private. They do not launch public entries, tasks, draw or winners.') } Configure operational campaign rules. Public launch is not available.</p>
          <div class="special-offer-editor-grid">
            ${[
              ['requires_login', 'Requires login'],
              ['requires_form', 'Requires form'],
              ['requires_manual_approval', 'Requires manual approval'],
              ['allow_multiple_entries', 'Allow multiple entries'],
              ['allow_bonus_points', 'Allow bonus points'],
              ['exclude_admins', 'Exclude admins'],
              ['exclude_partners', 'Exclude partners'],
              ['public_winner_display', 'Public winner display'],
            ].map(([name, label]) => `
              <label class="special-offer-editor-check">
                <input name="${name}" type="checkbox" ${defaults[name] ? 'checked' : ''} />
                ${label}
              </label>
            `).join('')}
            <label>Max entries per user
              <input name="max_entries_per_user" type="number" min="1" step="1" value="${escapeHtml(defaults.max_entries_per_user)}" />
            </label>
            <label>Response deadline days
              <input name="response_deadline_days" type="number" min="1" step="1" value="${escapeHtml(defaults.response_deadline_days)}" />
            </label>
            <details class="special-offer-advanced-source special-offer-editor-field--wide">
              <summary>Advanced settings JSON</summary>
              <p class="special-offer-editor-muted">Only edit this if you know what you are doing. Unknown keys are preserved unless you edit this JSON.</p>
              <textarea name="settings_json" rows="8">${escapeHtml(JSON.stringify(defaults.settings_json, null, 2))}</textarea>
            </details>
          </div>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="review" hidden>
          <h4>Review & save ${renderHelp('Save writes the draft/private campaign, translations, operational prizes, URL-only links and an audit event. It does not publish.')}</h4>
          <p class="special-offer-editor-muted">Save writes draft/private campaign data, translations, prizes, URL-only links and an audit log entry. It does not publish anything.</p>
          <div class="special-offer-editor-review" id="specialOfferEditorReview"></div>
        </section>
      </div>
    </form>
  `;
}

function syncEditorCollectionsFromDom() {
  $$('#specialOfferEditorPrizes [data-special-offers-prize]').forEach((node) => {
    const id = node.getAttribute('data-special-offers-prize');
    const prize = specialOffersState.editorPrizes.find((item) => item.client_id === id);
    if (!prize) return;
    $$('[data-prize-field]', node).forEach((field) => {
      const key = field.getAttribute('data-prize-field');
      if (!key) return;
      prize[key] = field.value;
    });
  });

  $$('#specialOfferEditorLinks [data-special-offers-link]').forEach((node) => {
    const id = node.getAttribute('data-special-offers-link');
    const link = specialOffersState.editorLinks.find((item) => item.client_id === id);
    if (!link) return;
    $$('[data-link-field]', node).forEach((field) => {
      const key = field.getAttribute('data-link-field');
      if (!key) return;
      link[key] = field.type === 'checkbox' ? field.checked : field.value;
    });
  });
}

function addEditorPrize(prize = {}) {
  syncEditorCollectionsFromDom();
  specialOffersState.editorPrizes.push({
    client_id: prize.client_id || prize.id || getTempId('prize'),
    id: prize.id || null,
    name: prize.name || '',
    description: prize.description || '',
    sponsor_name: prize.sponsor_name || '',
    quantity: prize.quantity || 1,
    value_estimate: prize.value_estimate || '',
    currency: prize.currency || 'EUR',
    restrictions: prize.restrictions || '',
    fulfillment_notes: prize.fulfillment_notes || '',
    sort_order: prize.sort_order || specialOffersState.editorPrizes.length,
  });
  renderPrizeEditorList();
  validateEditorForm();
}

function addEditorLink(link = {}) {
  syncEditorCollectionsFromDom();
  specialOffersState.editorLinks.push({
    client_id: link.client_id || link.id || getTempId('link'),
    id: link.id || null,
    link_type: link.link_type || 'custom',
    resource_id: null,
    url: link.url || '',
    label: link.label || '',
    description: link.description || '',
    is_primary: Boolean(link.is_primary),
    sort_order: link.sort_order || specialOffersState.editorLinks.length,
  });
  renderLinkEditorList();
  validateEditorForm();
}

function initializeEditorCollections(campaign) {
  specialOffersState.editorPrizes = toArray(campaign?.prizes).map((prize) => ({
    ...prize,
    client_id: prize.id || getTempId('prize'),
    currency: prize.currency || 'EUR',
  }));
  specialOffersState.editorLinks = toArray(campaign?.links).map((link) => ({
    ...link,
    client_id: link.id || getTempId('link'),
    resource_id: null,
  }));
  specialOffersState.removedPrizeIds = new Set();
  specialOffersState.removedLinkIds = new Set();
  if (!campaign && !specialOffersState.editorPrizes.length) addEditorPrize({ sort_order: 0 });
}

function openCampaignEditor(mode, campaignId = null) {
  const campaign = campaignId ? specialOffersState.campaigns.find((item) => item.id === campaignId) : null;
  if (mode === 'edit' && !isDraftPrivateCampaign(campaign)) {
    setErrorState('Editing for published/locked campaigns will be available in a later stage.');
    return;
  }

  const modal = getEditorModal();
  const title = $('#specialOffersEditorTitle');
  const subtitle = $('#specialOffersEditorSubtitle');
  const body = $('#specialOffersEditorBody');
  const archiveButton = $('#specialOffersEditorArchive');
  if (!modal || !body) return;

  specialOffersState.editorMode = mode;
  specialOffersState.editingCampaignId = campaignId;
  initializeEditorCollections(campaign);

  if (title) title.textContent = mode === 'edit' ? `Edit ${formatCampaignTitle(campaign)}` : 'Create campaign';
  if (subtitle) subtitle.textContent = 'Draft/private CRUD only. Publish stage is not available here.';
  if (archiveButton) archiveButton.hidden = mode !== 'edit';
  body.innerHTML = renderEditorForm(campaign);
  renderPrizeEditorList();
  renderLinkEditorList();
  setEditorMessage('');
  updateEditorReview();
  validateEditorForm();
  modal.hidden = false;
}

function closeCampaignEditor() {
  const modal = getEditorModal();
  if (modal) modal.hidden = true;
  specialOffersState.editingCampaignId = null;
  setEditorMessage('');
}

function activateEditorSection(button) {
  const key = button.getAttribute('data-special-offers-editor-tab');
  const modal = getEditorModal();
  if (!key || !modal) return;
  $$('[data-special-offers-editor-tab]', modal).forEach((tab) => {
    tab.classList.toggle('is-active', tab === button);
  });
  $$('[data-special-offers-editor-panel]', modal).forEach((panel) => {
    panel.hidden = panel.getAttribute('data-special-offers-editor-panel') !== key;
  });
  updateEditorReview();
}

function activateEditorLanguage(button) {
  const lang = button.getAttribute('data-special-offers-editor-lang-tab');
  const modal = getEditorModal();
  if (!lang || !modal) return;
  $$('[data-special-offers-editor-lang-tab]', modal).forEach((tab) => {
    tab.classList.toggle('is-active', tab === button);
  });
  $$('[data-special-offers-editor-lang-panel]', modal).forEach((panel) => {
    panel.hidden = panel.getAttribute('data-special-offers-editor-lang-panel') !== lang;
  });
}

function getEditorFieldValue(form, name) {
  return String(form.elements[name]?.value || '').trim();
}

function getEditorFieldChecked(form, name) {
  return Boolean(form.elements[name]?.checked);
}

function parseEditorJson(value, fallback, expectedType) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parsed = JSON.parse(text);
  if (expectedType === 'array' && !Array.isArray(parsed)) throw new Error('Expected JSON array');
  if (expectedType === 'object' && (Array.isArray(parsed) || !parsed || typeof parsed !== 'object')) throw new Error('Expected JSON object');
  return parsed;
}

function collectFaqItems(lang) {
  return $$(`[data-faq-item="${lang}"]`).map((node) => ({
    question: String(node.querySelector('[data-faq-field="question"]')?.value || '').trim(),
    answer: String(node.querySelector('[data-faq-field="answer"]')?.value || '').trim(),
  })).filter((item) => item.question || item.answer);
}

function collectRuleSections(lang, includeEmpty = false) {
  const sections = $$(`[data-rule-section="${lang}"]`).map((node) => ({
    title: String(node.querySelector('[data-rule-field="title"]')?.value || '').trim(),
    bullets: $$('[data-rule-bullet]', node)
      .map((bullet) => String(bullet.querySelector('[data-rule-field="bullet"]')?.value || '').trim())
      .filter(Boolean),
  }));
  return includeEmpty ? sections : sections.filter((section) => section.title || section.bullets.length);
}

function collectRulesHtml(lang) {
  const sections = collectRuleSections(lang);
  if (sections.length) return generateRulesHtml(sections);
  const builder = document.querySelector(`[data-rules-builder="${lang}"]`);
  const preserveSource = builder?.getAttribute('data-rules-source-preserve') === '1';
  const source = String(document.querySelector(`[name="${lang}_rules_html_source"]`)?.value || '').trim();
  return preserveSource ? source : '';
}

function collectEditorPayload() {
  const form = $('#specialOfferEditorForm');
  if (!form) throw new Error('Editor form is not available.');
  syncEditorCollectionsFromDom();

  const status = getEditorFieldValue(form, 'status') || 'draft';
  const visibility = getEditorFieldValue(form, 'visibility') || 'private';
  const startAt = parseDateTimeLocal(getEditorFieldValue(form, 'start_at'));
  const endAt = parseDateTimeLocal(getEditorFieldValue(form, 'end_at'));
  const winnerAnnounceAt = parseDateTimeLocal(getEditorFieldValue(form, 'winner_announce_at'));
  let settingsJson = {};
  try {
    settingsJson = parseEditorJson(form.elements.settings_json?.value || '{}', {}, 'object');
  } catch (error) {
    throw new Error(`Rules/settings: invalid settings JSON (${error.message || 'Expected JSON object'}).`);
  }

  const offer = {
    slug: normalizeSlug(getEditorFieldValue(form, 'slug')),
    type: getEditorFieldValue(form, 'type'),
    winner_selection_mode: getEditorFieldValue(form, 'winner_selection_mode'),
    status,
    visibility,
    start_at: startAt,
    end_at: endAt,
    winner_announce_at: winnerAnnounceAt,
    timezone: getEditorFieldValue(form, 'timezone') || 'Asia/Nicosia',
    requires_login: getEditorFieldChecked(form, 'requires_login'),
    requires_form: getEditorFieldChecked(form, 'requires_form'),
    requires_manual_approval: getEditorFieldChecked(form, 'requires_manual_approval'),
    allow_multiple_entries: getEditorFieldChecked(form, 'allow_multiple_entries'),
    max_entries_per_user: Number(getEditorFieldValue(form, 'max_entries_per_user') || 1),
    allow_bonus_points: getEditorFieldChecked(form, 'allow_bonus_points'),
    exclude_admins: getEditorFieldChecked(form, 'exclude_admins'),
    exclude_partners: getEditorFieldChecked(form, 'exclude_partners'),
    public_winner_display: getEditorFieldChecked(form, 'public_winner_display'),
    response_deadline_days: Number(getEditorFieldValue(form, 'response_deadline_days') || 1),
    settings_json: settingsJson,
  };

  const translations = SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language) => {
    const lang = language.code;
    const faqJson = collectFaqItems(lang);
    const rulesHtml = collectRulesHtml(lang);
    const translation = {
      lang,
      title: getEditorFieldValue(form, `${lang}_title`),
      short_description: getEditorFieldValue(form, `${lang}_short_description`),
      full_description: getEditorFieldValue(form, `${lang}_full_description`),
      prize_description: getEditorFieldValue(form, `${lang}_prize_description`),
      rules_html: rulesHtml,
      faq_json: faqJson,
      seo_title: getEditorFieldValue(form, `${lang}_seo_title`),
      seo_description: getEditorFieldValue(form, `${lang}_seo_description`),
    };
    const hasData = Object.entries(translation).some(([key, value]) => key !== 'lang' && key !== 'faq_json' && String(value || '').trim())
      || toArray(faqJson).length > 0;
    return hasData ? translation : null;
  }).filter(Boolean);

  const prizes = specialOffersState.editorPrizes.map((prize, index) => ({
    id: prize.id || null,
    name: String(prize.name || '').trim(),
    description: String(prize.description || '').trim() || null,
    sponsor_name: String(prize.sponsor_name || '').trim() || null,
    quantity: Number(prize.quantity || 1),
    value_estimate: String(prize.value_estimate || '').trim() ? Number(prize.value_estimate) : null,
    currency: String(prize.currency || 'EUR').trim() || 'EUR',
    restrictions: String(prize.restrictions || '').trim() || null,
    fulfillment_notes: String(prize.fulfillment_notes || '').trim() || null,
    sort_order: Number(prize.sort_order || index),
  }));

  const links = specialOffersState.editorLinks.map((link, index) => ({
    id: link.id || null,
    link_type: String(link.link_type || '').trim(),
    resource_id: null,
    url: String(link.url || '').trim(),
    label: String(link.label || '').trim(),
    description: String(link.description || '').trim() || null,
    is_primary: Boolean(link.is_primary),
    sort_order: Number(link.sort_order || index),
  }));

  return { offer, translations, prizes, links };
}

function validateEditorPayload(payload) {
  const errors = [];
  if (!payload.offer.slug) errors.push('Basic settings: slug is required.');
  if (payload.offer.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.offer.slug)) errors.push('Basic settings: slug must be lowercase URL-safe text.');
  if (!SPECIAL_OFFERS_TYPES.includes(payload.offer.type)) errors.push('Basic settings: type is required.');
  if (!SPECIAL_OFFERS_WINNER_MODES.includes(payload.offer.winner_selection_mode)) errors.push('Basic settings: winner mode is required.');
  if (!['draft', 'archived'].includes(payload.offer.status)) errors.push('Basic settings: only draft or archived status is available in this stage.');
  if (payload.offer.visibility !== 'private') errors.push('Basic settings: visibility must remain private in this stage.');
  if (!payload.offer.timezone) errors.push('Dates & visibility: timezone is required.');
  if (payload.offer.start_at && payload.offer.end_at && new Date(payload.offer.end_at) < new Date(payload.offer.start_at)) errors.push('Dates & visibility: end at cannot be before start at.');
  if (payload.offer.end_at && payload.offer.winner_announce_at && new Date(payload.offer.winner_announce_at) < new Date(payload.offer.end_at)) errors.push('Dates & visibility: winner announce at cannot be before end at.');
  if (payload.offer.max_entries_per_user < 1) errors.push('Rules/settings: max entries per user must be at least 1.');
  if (payload.offer.response_deadline_days < 1) errors.push('Rules/settings: response deadline days must be at least 1.');
  const pl = payload.translations.find((item) => item.lang === 'pl');
  if (!pl?.title) errors.push('Content PL / EN / HE: PL title is required.');
  SPECIAL_OFFERS_DETAIL_LANGUAGES.forEach((language) => {
    collectFaqItems(language.code).forEach((item, index) => {
      if (!item.question || !item.answer) errors.push(`Content ${language.label}: FAQ item ${index + 1} needs both question and answer.`);
    });
    collectRuleSections(language.code, true).forEach((section, index) => {
      if (!section.title && !section.bullets.length) errors.push(`Content ${language.label}: rule section ${index + 1} needs a title or bullet.`);
      if (section.title && !section.bullets.length) errors.push(`Content ${language.label}: rule section ${index + 1} needs at least one bullet.`);
    });
  });
  payload.prizes.forEach((prize, index) => {
    if (!prize.name) errors.push(`Prize operational details: prize ${index + 1} name is required.`);
    if (prize.quantity < 1) errors.push(`Prize operational details: prize ${index + 1} quantity must be at least 1.`);
  });
  payload.links.forEach((link, index) => {
    if (!SPECIAL_OFFERS_LINK_TYPES.includes(link.link_type)) errors.push(`Linked services: link ${index + 1} type is required.`);
    if (!link.label) errors.push(`Linked services: link ${index + 1} label is required.`);
    if (!link.url) errors.push(`Linked services: link ${index + 1} URL is required.`);
    if (link.url && !/^(\/|https?:\/\/)/i.test(link.url)) errors.push(`Linked services: link ${index + 1} URL must be relative or http(s).`);
    if (link.resource_id) errors.push(`Linked services: link ${index + 1} resource ID is not available in this stage.`);
  });
  if (payload.links.filter((link) => link.is_primary).length > 1) errors.push('Linked services: only one primary CTA is allowed.');
  return errors;
}

function validateEditorForm({ silent = true } = {}) {
  const saveButton = $('#specialOffersEditorSave');
  let errors = [];
  try {
    const payload = collectEditorPayload();
    errors = validateEditorPayload(payload);
  } catch (error) {
    errors = [error.message || 'Invalid editor data.'];
  }
  if (saveButton) saveButton.disabled = Boolean(errors.length) || specialOffersState.saving;
  if (!silent && errors.length) setEditorMessage(errors.join(' '), 'error');
  updateEditorReview(errors);
  return errors;
}

function updateEditorReview(errors = []) {
  const node = $('#specialOfferEditorReview');
  if (!node) return;
  let payload = null;
  try {
    payload = collectEditorPayload();
  } catch (_error) {
    node.innerHTML = '<p class="special-offers-empty-copy">Fix validation errors before review.</p>';
    return;
  }
  node.innerHTML = `
    <div class="special-offers-detail-list">
      ${renderDetailRows([
        ['Slug', payload.offer.slug],
        ['Status', titleCase(payload.offer.status)],
        ['Visibility', titleCase(payload.offer.visibility)],
        ['Translations', payload.translations.map((item) => item.lang.toUpperCase()).join(', ') || 'None'],
        ['Prizes', payload.prizes.length],
        ['Links', payload.links.length],
      ])}
    </div>
    ${errors.length ? `<p class="special-offer-editor-validation">${escapeHtml(errors.join(' '))}</p>` : '<p class="special-offer-editor-success">Ready to save as draft/private.</p>'}
  `;
}

function assertSupabaseResult(result, fallbackMessage) {
  if (result?.error) throw new Error(result.error.message || fallbackMessage);
  return result?.data ?? null;
}

async function getAuditActorId(client) {
  try {
    const result = await client.auth.getUser();
    return result?.data?.user?.id || null;
  } catch (_error) {
    return null;
  }
}

async function insertSpecialOfferAudit(client, action, offerId, oldValue, newValue) {
  const actorId = await getAuditActorId(client);
  const result = await client.from('special_offer_audit_log').insert({
    offer_id: offerId,
    actor_id: actorId,
    action,
    entity_type: 'special_offer',
    entity_id: offerId,
    old_value: oldValue || null,
    new_value: newValue || null,
    metadata: {
      source: 'admin_special_offers_crud',
      stage: '3B.2',
      is_client_side_audit: true,
    },
  });
  if (result?.error) throw result.error;
}

async function saveTranslations(client, offerId, translations) {
  for (const translation of translations) {
    const result = await client.from('special_offer_translations').upsert(
      { ...translation, offer_id: offerId },
      { onConflict: 'offer_id,lang' },
    );
    assertSupabaseResult(result, 'Failed to save translation.');
  }
}

async function savePrizes(client, offerId, prizes) {
  for (const prizeId of specialOffersState.removedPrizeIds) {
    assertSupabaseResult(await client.from('special_offer_prizes').delete().eq('id', prizeId), 'Failed to remove prize.');
  }
  for (const prize of prizes) {
    const payload = { ...prize, offer_id: offerId };
    if (payload.id) {
      const id = payload.id;
      delete payload.id;
      assertSupabaseResult(await client.from('special_offer_prizes').update(payload).eq('id', id), 'Failed to update prize.');
    } else {
      delete payload.id;
      assertSupabaseResult(await client.from('special_offer_prizes').insert(payload), 'Failed to insert prize.');
    }
  }
}

async function saveLinks(client, offerId, links) {
  for (const linkId of specialOffersState.removedLinkIds) {
    assertSupabaseResult(await client.from('special_offer_links').delete().eq('id', linkId), 'Failed to remove link.');
  }
  for (const link of links) {
    const payload = { ...link, offer_id: offerId, resource_id: null };
    if (payload.id) {
      const id = payload.id;
      delete payload.id;
      assertSupabaseResult(await client.from('special_offer_links').update(payload).eq('id', id), 'Failed to update link.');
    } else {
      delete payload.id;
      assertSupabaseResult(await client.from('special_offer_links').insert(payload), 'Failed to insert link.');
    }
  }
}

async function saveCampaignFromEditor() {
  const errors = validateEditorForm({ silent: false });
  if (errors.length) return;

  const client = getSupabaseClient();
  if (!client) {
    setEditorMessage('Supabase client is not available.', 'error');
    return;
  }

  const payload = collectEditorPayload();
  const existingCampaign = getCurrentCampaign();
  const oldSnapshot = buildCampaignSnapshot(existingCampaign);
  setEditorSaving(true);
  setEditorMessage('');

  try {
    const actorId = await getAuditActorId(client);
    let offerId = existingCampaign?.id || null;
    const offerPayload = {
      ...payload.offer,
      visibility: 'private',
      updated_by: actorId,
      archived_at: payload.offer.status === 'archived' ? new Date().toISOString() : null,
    };

    if (specialOffersState.editorMode === 'create') {
      offerPayload.status = offerPayload.status === 'archived' ? 'archived' : 'draft';
      offerPayload.created_by = actorId;
      const inserted = assertSupabaseResult(
        await client.from('special_offers').insert(offerPayload).select(SPECIAL_OFFERS_SELECT).single(),
        'Failed to create campaign.',
      );
      offerId = inserted.id;
    } else {
      if (!isDraftPrivateCampaign(existingCampaign)) throw new Error('Only draft/private campaigns can be edited in this stage.');
      assertSupabaseResult(await client.from('special_offers').update(offerPayload).eq('id', offerId), 'Failed to update campaign.');
    }

    await saveTranslations(client, offerId, payload.translations);
    await savePrizes(client, offerId, payload.prizes);
    await saveLinks(client, offerId, payload.links);

    let auditWarning = '';
    try {
      await insertSpecialOfferAudit(
        client,
        specialOffersState.editorMode === 'create' ? 'special_offer.created' : 'special_offer.updated',
        offerId,
        specialOffersState.editorMode === 'create' ? null : oldSnapshot,
        { ...buildCampaignSnapshot({ ...payload.offer, id: offerId, translations: payload.translations, prizes: payload.prizes, links: payload.links }), stage: '3B.2' },
      );
    } catch (auditError) {
      console.error('Special Offers audit insert failed:', auditError);
      auditWarning = ' Saved, but audit log insert failed.';
    }

    await refreshSpecialOffers();
    closeCampaignEditor();
    setErrorState('');
    setHeaderStatus(`Saved draft/private campaign.${auditWarning}`, auditWarning ? 'pending' : 'ready');
  } catch (error) {
    console.error('Failed to save Special Offers campaign:', error);
    setEditorMessage(error.message || 'Failed to save campaign.', 'error');
  } finally {
    setEditorSaving(false);
  }
}

async function archiveCurrentCampaign() {
  const campaign = getCurrentCampaign();
  if (!isDraftPrivateCampaign(campaign)) {
    setEditorMessage('Only draft/private campaigns can be archived in this stage.', 'error');
    return;
  }
  if (!window.confirm('Archive this campaign? It will not be hard deleted.')) return;

  const client = getSupabaseClient();
  if (!client) {
    setEditorMessage('Supabase client is not available.', 'error');
    return;
  }

  setEditorSaving(true);
  try {
    const actorId = await getAuditActorId(client);
    assertSupabaseResult(
      await client.from('special_offers').update({
        status: 'archived',
        visibility: 'private',
        archived_at: new Date().toISOString(),
        updated_by: actorId,
      }).eq('id', campaign.id),
      'Failed to archive campaign.',
    );

    try {
      await insertSpecialOfferAudit(client, 'special_offer.archived', campaign.id, buildCampaignSnapshot(campaign), {
        id: campaign.id,
        slug: campaign.slug,
        status: 'archived',
        visibility: 'private',
      });
    } catch (auditError) {
      console.error('Special Offers archive audit insert failed:', auditError);
      setEditorMessage('Campaign archived, but audit log insert failed.', 'warning');
    }

    await refreshSpecialOffers();
    closeCampaignEditor();
    setHeaderStatus('Campaign archived', 'ready');
  } catch (error) {
    console.error('Failed to archive Special Offers campaign:', error);
    setEditorMessage(error.message || 'Failed to archive campaign.', 'error');
  } finally {
    setEditorSaving(false);
  }
}

function openCampaignDetails(campaignId) {
  const campaign = specialOffersState.campaigns.find((item) => item.id === campaignId);
  if (!campaign) return;

  const modal = $('#specialOffersDetailsModal');
  const title = $('#specialOffersDetailsTitle');
  const body = $('#specialOffersDetailsBody');
  const canEdit = isDraftPrivateCampaign(campaign);

  if (title) title.textContent = formatCampaignTitle(campaign);
  if (body) {
    body.innerHTML = `
      <div class="special-offers-details-grid">
        <section class="special-offers-detail-panel">
          <h4>Campaign</h4>
          ${renderDetailRows([
            ['Slug', campaign.slug],
            ['Status', titleCase(campaign.status)],
            ['Visibility', titleCase(campaign.visibility)],
            ['Type', titleCase(campaign.type)],
            ['Winner mode', titleCase(campaign.winner_selection_mode)],
            ['Timezone', campaign.timezone],
            ['Dates', `${formatDate(campaign.start_at)} - ${formatDate(campaign.end_at)}`],
            ['Winner announce', formatDate(campaign.winner_announce_at)],
          ])}
        </section>
        <section class="special-offers-detail-panel special-offers-detail-panel--wide">
          <h4>Content translations</h4>
          ${renderTranslationsTabs(campaign)}
        </section>
        <section class="special-offers-detail-panel special-offers-detail-panel--wide">
          <h4>Prize</h4>
          ${renderPrizes(campaign.prizes)}
        </section>
        <section class="special-offers-detail-panel special-offers-detail-panel--wide">
          <h4>Linked services</h4>
          ${renderLinkedServices(campaign.links)}
        </section>
        <section class="special-offers-detail-panel special-offers-detail-panel--wide">
          <h4>Audit log</h4>
          ${renderAuditLog(campaign.audit_log)}
        </section>
        <section class="special-offers-detail-panel special-offers-detail-panel--wide">
          <h4>Settings summary</h4>
          ${renderSettingsSummary(campaign.settings_json || {})}
          <div class="special-offers-disabled-actions">
            <button
              class="btn-secondary btn-small"
              type="button"
              data-special-offers-edit="${escapeHtml(campaign.id)}"
              ${canEdit ? '' : 'disabled title="Editing for published/locked campaigns will be available in a later stage."'}
            >Edit campaign</button>
            <button class="btn-secondary btn-small" type="button" disabled title="Entries will be available in next stages">Entries</button>
            <button class="btn-secondary btn-small" type="button" disabled title="Draw machine not configured yet">Draw</button>
          </div>
        </section>
      </div>
    `;
  }

  if (modal) modal.hidden = false;
}

function activateTranslationTab(button) {
  const modal = $('#specialOffersDetailsModal');
  if (!modal || !button) return;

  const lang = button.getAttribute('data-special-offers-lang-tab');
  if (!lang) return;

  $$('[data-special-offers-lang-tab]', modal).forEach((tab) => {
    const isActive = tab === button;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  $$('[data-special-offers-lang-panel]', modal).forEach((panel) => {
    panel.hidden = panel.getAttribute('data-special-offers-lang-panel') !== lang;
  });
}

function closeCampaignDetails() {
  const modal = $('#specialOffersDetailsModal');
  if (modal) modal.hidden = true;
}

function refreshBuilderPreviews(root = document) {
  SPECIAL_OFFERS_DETAIL_LANGUAGES.forEach((language) => {
    const faqList = root.querySelector(`[data-faq-list="${language.code}"]`);
    if (faqList && !faqList.querySelector('[data-faq-item]') && !faqList.querySelector('.special-offers-empty-copy')) {
      faqList.innerHTML = '<p class="special-offers-empty-copy">No FAQ items yet</p>';
    }
    const rulesList = root.querySelector(`[data-rules-list="${language.code}"]`);
    if (rulesList && !rulesList.querySelector('[data-rule-section]') && !rulesList.querySelector('.special-offers-empty-copy')) {
      rulesList.innerHTML = '<p class="special-offers-empty-copy">No rule sections yet</p>';
    }
    const faqPreview = root.querySelector(`[data-faq-json-preview="${language.code}"]`);
    if (faqPreview) faqPreview.textContent = JSON.stringify(collectFaqItems(language.code), null, 2);
    const rulesPreview = root.querySelector(`[data-rules-html-preview="${language.code}"]`);
    if (rulesPreview) rulesPreview.textContent = generateRulesHtml(collectRuleSections(language.code));
  });
  $$('[data-link-url-preview]', root).forEach((node) => {
    const item = node.closest('[data-special-offers-link]');
    const url = item?.querySelector('[data-link-field="url"]')?.value || '';
    node.innerHTML = renderLanguageUrlPreview(url);
  });
}

function addFaqItem(lang) {
  const list = document.querySelector(`[data-faq-list="${lang}"]`);
  if (!list) return;
  const dir = SPECIAL_OFFERS_DETAIL_LANGUAGES.find((item) => item.code === lang)?.dir || 'ltr';
  if (list.querySelector('.special-offers-empty-copy')) list.innerHTML = '';
  list.insertAdjacentHTML('beforeend', renderFaqEditorItem(lang, {}, list.querySelectorAll('[data-faq-item]').length, dir));
  refreshBuilderPreviews();
  validateEditorForm();
}

function addRuleSection(lang) {
  const list = document.querySelector(`[data-rules-list="${lang}"]`);
  if (!list) return;
  const dir = SPECIAL_OFFERS_DETAIL_LANGUAGES.find((item) => item.code === lang)?.dir || 'ltr';
  if (list.querySelector('.special-offers-empty-copy')) list.innerHTML = '';
  list.insertAdjacentHTML('beforeend', renderRuleSection(lang, { title: '', bullets: [] }, list.querySelectorAll('[data-rule-section]').length, dir));
  refreshBuilderPreviews();
  validateEditorForm();
}

function addRuleBullet(button) {
  const section = button.closest('[data-rule-section]');
  const list = section?.querySelector('[data-rule-bullets]');
  if (!list) return;
  const panel = button.closest('[data-special-offers-editor-lang-panel]');
  const lang = panel?.getAttribute('data-special-offers-editor-lang-panel') || 'pl';
  const dir = SPECIAL_OFFERS_DETAIL_LANGUAGES.find((item) => item.code === lang)?.dir || 'ltr';
  if (list.querySelector('.special-offers-empty-copy')) list.innerHTML = '';
  list.insertAdjacentHTML('beforeend', renderRuleBullet('', dir));
  refreshBuilderPreviews();
  validateEditorForm();
}

function bindEvents() {
  if (specialOffersState.initialized) return;
  specialOffersState.initialized = true;

  const grid = $('#specialOffersCampaignGrid');
  if (grid) {
    grid.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const viewButton = target?.closest('[data-special-offers-view]');
      const editButton = target?.closest('[data-special-offers-edit]');
      if (viewButton) {
        openCampaignDetails(viewButton.getAttribute('data-special-offers-view'));
        return;
      }
      if (editButton && !editButton.disabled) {
        openCampaignEditor('edit', editButton.getAttribute('data-special-offers-edit'));
      }
    });
  }

  const detailsBody = $('#specialOffersDetailsBody');
  if (detailsBody) {
    detailsBody.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const langButton = target?.closest('[data-special-offers-lang-tab]');
      const editButton = target?.closest('[data-special-offers-edit]');
      if (langButton) activateTranslationTab(langButton);
      if (editButton && !editButton.disabled) {
        closeCampaignDetails();
        openCampaignEditor('edit', editButton.getAttribute('data-special-offers-edit'));
      }
    });
  }

  $$('[data-special-offers-create]').forEach((button) => {
    button.addEventListener('click', () => openCampaignEditor('create'));
  });

  const editorBody = $('#specialOffersEditorBody');
  if (editorBody) {
    editorBody.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const sectionTab = target?.closest('[data-special-offers-editor-tab]');
      const langTab = target?.closest('[data-special-offers-editor-lang-tab]');
      const addPrizeButton = target?.closest('[data-special-offers-add-prize]');
      const addLinkButton = target?.closest('[data-special-offers-add-link]');
      const removePrizeButton = target?.closest('[data-special-offers-remove-prize]');
      const removeLinkButton = target?.closest('[data-special-offers-remove-link]');
      const addFaqButton = target?.closest('[data-special-offers-add-faq]');
      const removeFaqButton = target?.closest('[data-special-offers-remove-faq]');
      const addRuleSectionButton = target?.closest('[data-special-offers-add-rule-section]');
      const removeRuleSectionButton = target?.closest('[data-special-offers-remove-rule-section]');
      const addRuleBulletButton = target?.closest('[data-special-offers-add-rule-bullet]');
      const removeRuleBulletButton = target?.closest('[data-special-offers-remove-rule-bullet]');
      if (sectionTab) activateEditorSection(sectionTab);
      if (langTab) activateEditorLanguage(langTab);
      if (addPrizeButton) addEditorPrize();
      if (addLinkButton) addEditorLink();
      if (addFaqButton) addFaqItem(addFaqButton.getAttribute('data-special-offers-add-faq'));
      if (removeFaqButton) {
        removeFaqButton.closest('[data-faq-item]')?.remove();
        refreshBuilderPreviews();
        validateEditorForm();
      }
      if (addRuleSectionButton) addRuleSection(addRuleSectionButton.getAttribute('data-special-offers-add-rule-section'));
      if (removeRuleSectionButton) {
        removeRuleSectionButton.closest('[data-rule-section]')?.remove();
        refreshBuilderPreviews();
        validateEditorForm();
      }
      if (addRuleBulletButton) addRuleBullet(addRuleBulletButton);
      if (removeRuleBulletButton) {
        removeRuleBulletButton.closest('[data-rule-bullet]')?.remove();
        refreshBuilderPreviews();
        validateEditorForm();
      }
      if (removePrizeButton) {
        const id = removePrizeButton.getAttribute('data-special-offers-remove-prize');
        const prize = specialOffersState.editorPrizes.find((item) => item.client_id === id);
        if (prize && window.confirm('Remove this prize from the draft campaign?')) {
          if (prize.id) specialOffersState.removedPrizeIds.add(prize.id);
          specialOffersState.editorPrizes = specialOffersState.editorPrizes.filter((item) => item.client_id !== id);
          renderPrizeEditorList();
          validateEditorForm();
        }
      }
      if (removeLinkButton) {
        const id = removeLinkButton.getAttribute('data-special-offers-remove-link');
        const link = specialOffersState.editorLinks.find((item) => item.client_id === id);
        if (link && window.confirm('Remove this linked service from the draft campaign?')) {
          if (link.id) specialOffersState.removedLinkIds.add(link.id);
          specialOffersState.editorLinks = specialOffersState.editorLinks.filter((item) => item.client_id !== id);
          renderLinkEditorList();
          validateEditorForm();
        }
      }
    });
    editorBody.addEventListener('input', () => {
      refreshBuilderPreviews(editorBody);
      validateEditorForm();
    });
    editorBody.addEventListener('change', () => {
      refreshBuilderPreviews(editorBody);
      validateEditorForm();
    });
  }

  const saveButton = $('#specialOffersEditorSave');
  if (saveButton) saveButton.addEventListener('click', () => saveCampaignFromEditor());

  const archiveButton = $('#specialOffersEditorArchive');
  if (archiveButton) archiveButton.addEventListener('click', () => archiveCurrentCampaign());

  $$('[data-special-offers-editor-close]').forEach((button) => {
    button.addEventListener('click', closeCampaignEditor);
  });

  const slugInput = document.querySelector('#specialOffersEditorBody input[name="slug"]');
  if (slugInput) {
    slugInput.addEventListener('blur', () => {
      slugInput.value = normalizeSlug(slugInput.value);
      validateEditorForm();
    });
  }

  $$('[data-special-offers-close]').forEach((button) => {
    button.addEventListener('click', closeCampaignDetails);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCampaignDetails();
      closeCampaignEditor();
    }
  });
}

async function refreshSpecialOffers() {
  specialOffersState.loading = true;
  setLoadingState(true);
  setErrorState('');

  try {
    const campaigns = await loadSpecialOffersReadOnly();
    specialOffersState.campaigns = campaigns;
    renderStats(campaigns);
    renderCampaigns(campaigns);
  } catch (error) {
    console.error('Failed to load Special Offers data:', error);
    renderStats([]);
    setHidden($('#specialOffersEmptyState'), true);
    setHidden($('#specialOffersCampaigns'), true);
    const grid = $('#specialOffersCampaignGrid');
    if (grid) grid.innerHTML = '';
    setErrorState('Unable to load Special Offers data. Check admin access and Special Offers RLS.');
    setHeaderStatus('Load error', 'error');
  } finally {
    specialOffersState.loading = false;
    setLoadingState(false);
  }
}

export async function initSpecialOffers() {
  bindEvents();
  if (specialOffersState.loading) return;
  await refreshSpecialOffers();
}

window.CyprusEyeSpecialOffersAdmin = {
  initSpecialOffers,
  loadSpecialOffersReadOnly,
};
