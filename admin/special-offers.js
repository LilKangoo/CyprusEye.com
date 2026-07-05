const SPECIAL_OFFERS_SELECT = 'id, slug, type, winner_selection_mode, status, visibility, start_at, end_at, winner_announce_at, timezone, settings_json, created_at, updated_at';
const SPECIAL_OFFERS_TRANSLATIONS_SELECT = 'id, offer_id, lang, title, short_description, full_description, prize_description, rules_html, faq_json, seo_title, seo_description';
const SPECIAL_OFFERS_PRIZES_SELECT = 'id, offer_id, name, description, sponsor_name, quantity, value_estimate, currency, restrictions, fulfillment_notes, sort_order';
const SPECIAL_OFFERS_LINKS_SELECT = 'id, offer_id, link_type, resource_id, url, label, description, is_primary, sort_order';

const specialOffersState = {
  initialized: false,
  loading: false,
  campaigns: [],
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
  const translation = campaign.translations.find((row) => row.lang === 'pl') || campaign.translations[0];
  return translation?.title || campaign.slug || 'Untitled campaign';
}

function getPrimaryTranslation(campaign) {
  return campaign.translations.find((row) => row.lang === 'pl') || campaign.translations[0] || null;
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
  setHeaderStatus('Read-only live data', 'ready');
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

  const [translationsResult, prizesResult, linksResult] = await Promise.all([
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
  ]);

  if (translationsResult.error) throw translationsResult.error;
  if (prizesResult.error) throw prizesResult.error;
  if (linksResult.error) throw linksResult.error;

  return normalizeCampaigns(
    offers,
    groupByOfferId(translationsResult.data),
    groupByOfferId(prizesResult.data),
    groupByOfferId(linksResult.data),
  );
}

function renderDetailRows(rows) {
  return `
    <div class="special-offers-detail-list">
      ${rows.map(([label, value]) => `
        <div class="special-offers-detail-row">
          <span>${escapeHtml(label)}</span>
          <span>${escapeHtml(value || 'Not set')}</span>
        </div>
      `).join('')}
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

function openCampaignDetails(campaignId) {
  const campaign = specialOffersState.campaigns.find((item) => item.id === campaignId);
  if (!campaign) return;

  const modal = $('#specialOffersDetailsModal');
  const title = $('#specialOffersDetailsTitle');
  const body = $('#specialOffersDetailsBody');
  const translation = getPrimaryTranslation(campaign);

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
        <section class="special-offers-detail-panel">
          <h4>PL content</h4>
          ${renderDetailRows([
            ['Title', translation?.title || campaign.slug],
            ['Short description', translation?.short_description],
            ['Prize description', translation?.prize_description],
          ])}
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
          <h4>Settings summary</h4>
          ${renderSettingsSummary(campaign.settings_json || {})}
          <div class="special-offers-disabled-actions">
            <button class="btn-secondary btn-small" type="button" disabled title="Available in CRUD stage">Edit campaign</button>
            <button class="btn-secondary btn-small" type="button" disabled title="Entries will be available in next stages">Entries</button>
            <button class="btn-secondary btn-small" type="button" disabled title="Draw machine not configured yet">Draw</button>
          </div>
        </section>
      </div>
    `;
  }

  if (modal) modal.hidden = false;
}

function closeCampaignDetails() {
  const modal = $('#specialOffersDetailsModal');
  if (modal) modal.hidden = true;
}

function bindEvents() {
  if (specialOffersState.initialized) return;
  specialOffersState.initialized = true;

  const grid = $('#specialOffersCampaignGrid');
  if (grid) {
    grid.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('[data-special-offers-view]');
      if (!button) return;
      openCampaignDetails(button.getAttribute('data-special-offers-view'));
    });
  }

  $$('[data-special-offers-close]').forEach((button) => {
    button.addEventListener('click', closeCampaignDetails);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCampaignDetails();
  });
}

export async function initSpecialOffers() {
  bindEvents();
  if (specialOffersState.loading) return;

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

window.CyprusEyeSpecialOffersAdmin = {
  initSpecialOffers,
  loadSpecialOffersReadOnly,
};
