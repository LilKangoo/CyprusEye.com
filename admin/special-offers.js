const SPECIAL_OFFERS_SELECT = 'id, slug, type, winner_selection_mode, status, visibility, start_at, end_at, winner_announce_at, timezone, requires_login, requires_form, requires_manual_approval, allow_multiple_entries, max_entries_per_user, allow_bonus_points, exclude_admins, exclude_partners, public_winner_display, response_deadline_days, settings_json, created_at, updated_at, archived_at';
const SPECIAL_OFFERS_TRANSLATIONS_SELECT = 'id, offer_id, lang, title, short_description, full_description, prize_description, rules_html, faq_json, seo_title, seo_description';
const SPECIAL_OFFERS_PRIZES_SELECT = 'id, offer_id, name, description, sponsor_name, quantity, value_estimate, currency, restrictions, fulfillment_notes, sort_order';
const SPECIAL_OFFERS_PRIZE_TRANSLATIONS_SELECT = 'id, prize_id, lang, name, description, restrictions, fulfillment_notes';
const SPECIAL_OFFERS_LINKS_SELECT = 'id, offer_id, link_type, resource_id, url, label, description, image_url, is_primary, sort_order';
const SPECIAL_OFFERS_LINK_TRANSLATIONS_SELECT = 'id, link_id, lang, label, description, url';
const SPECIAL_OFFERS_FORM_FIELDS_SELECT = 'id, offer_id, field_key, field_type, required, active, sort_order, validation_json, admin_note, created_at, updated_at';
const SPECIAL_OFFERS_FORM_FIELD_TRANSLATIONS_SELECT = 'id, field_id, lang, label, placeholder, help_text, options_json, created_at, updated_at';
const SPECIAL_OFFERS_AUDIT_SELECT = 'id, offer_id, actor_id, action, entity_type, entity_id, old_value, new_value, metadata, created_at';
const SPECIAL_OFFER_ENTRIES_LIST_SELECT = 'id, offer_id, reference, status, submitted_lang, normalized_email, first_name, last_name, created_at, reviewed_at, reviewed_by';
const SPECIAL_OFFER_ENTRIES_DETAIL_SELECT = 'id, offer_id, user_id, status, submitted_lang, normalized_email, first_name, last_name, phone, answers_json, form_snapshot_json, client_submission_id, reference, reviewed_at, reviewed_by, review_note, rejection_reason, correction_count, corrected_at, correction_client_submission_id, created_at, updated_at';
const SPECIAL_OFFER_ENTRY_ANSWERS_SELECT = 'id, entry_id, field_id, field_key, value_text, value_json, field_snapshot_json, created_at';
const SPECIAL_OFFER_OFFICIAL_POSTS_SELECT = 'id, offer_id, post_order, week_number, admin_title, platform, official_url, external_post_id, published_at, comment_deadline_at, active, created_by, updated_by, created_at, updated_at';
const SPECIAL_OFFER_ACTIVITIES_SELECT = 'id, offer_id, entry_id, official_post_id, activity_type, evidence_url, evidence_text, participant_reported_at, verified_activity_at, status, points_awarded, verified_at, verified_by, review_note, rejection_reason, created_by, client_submission_id, created_at, updated_at';
const SPECIAL_OFFER_WINNER_WORKFLOWS_SELECT = 'id, offer_id, status, started_by, started_at, decision_reason, confirmed_entry_id, confirmed_at, published_at, cancelled_at, cancelled_by, created_at, updated_at';
const SPECIAL_OFFER_WINNER_SHORTLIST_SELECT = 'id, workflow_id, offer_id, entry_id, status, role, backup_rank, score_snapshot_json, entry_status_snapshot, added_by, added_at, rechecked_by, rechecked_at, removed_by, removed_at, created_at, updated_at';
const SPECIAL_OFFER_WINNER_CONTACT_EVENTS_SELECT = 'id, workflow_id, shortlist_id, entry_id, status, contact_started_at, response_deadline_at, accepted_at, declined_at, no_response_at, replaced_at, note_text, created_by, created_at';
const SPECIAL_OFFER_WINNER_PUBLICATIONS_SELECT = 'id, workflow_id, offer_id, entry_id, public_name, publication_consent_confirmed, consent_confirmed_by, consent_confirmed_at, published_by, published_at, unpublished_at, unpublish_reason_present, created_at';

const specialOffersState = {
  initialized: false,
  loading: false,
  campaigns: [],
  entryCounts: {},
  entries: {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 10,
    status: 'all',
    search: '',
    offerId: 'all',
    loading: false,
    error: '',
    selectedEntryId: null,
    detail: null,
    reviewAction: '',
    reviewing: false,
    deleteOpen: false,
    deleting: false,
  },
  manualVerification: {
    offerId: 'all',
    posts: [],
    postsLoading: false,
    postsError: '',
    postEditingId: '',
    postSaving: false,
    postActivityCounts: {},
    postDelete: {
      postId: '',
      deleting: false,
      error: '',
      lastTrigger: null,
    },
    activities: {
      rows: [],
      entriesById: {},
      postsById: {},
      total: 0,
      page: 1,
      pageSize: 10,
      status: 'all',
      activityType: 'all',
      officialPostId: 'all',
      search: '',
      loading: false,
      error: '',
      selectedActivityId: null,
      detail: null,
      reviewAction: '',
      reviewing: false,
    },
    counts: {},
  },
  manualWinner: {
    offerId: 'all',
    loading: false,
    error: '',
    errorMeta: null,
    readiness: null,
    workflows: [],
    activeWorkflow: null,
    shortlist: [],
    contacts: [],
    publications: [],
    eligibleEntries: [],
    entriesById: {},
    scoresByEntryId: {},
    activitiesByEntryId: {},
    auditLog: [],
    action: {
      type: '',
      targetId: '',
      submitting: false,
      error: '',
    },
    lastTrigger: null,
  },
  editorMode: 'create',
  editingCampaignId: null,
  editorPrizes: [],
  editorLinks: [],
  editorFormFields: [],
  removedPrizeIds: new Set(),
  removedLinkIds: new Set(),
  resourceOptions: {
    cars: [],
    trips: [],
    hotels: [],
    transport: [],
  },
  resourceOptionsLoaded: false,
  resourceOptionsErrors: {},
  saving: false,
};

const SPECIAL_OFFERS_DETAIL_LANGUAGES = [
  { code: 'pl', label: 'PL', dir: 'ltr' },
  { code: 'en', label: 'EN', dir: 'ltr' },
  { code: 'he', label: 'HE', dir: 'rtl' },
];

const SPECIAL_OFFERS_TYPES = ['contest', 'giveaway', 'weighted_draw', 'partner_promo', 'coupon_promo', 'landing_only'];
const SPECIAL_OFFERS_WINNER_MODES = ['manual_selection', 'weighted_draw', 'none'];
const SPECIAL_OFFERS_FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'phone',
  'date',
  'date_of_birth',
  'country',
  'city',
  'url',
  'select',
  'checkbox',
  'checkbox_group',
  'consent',
  'contest_answer',
  'facebook_profile_url',
  'shared_post_url',
  'custom',
];
const SPECIAL_OFFER_ENTRY_STATUSES = ['submitted', 'pending_review', 'approved', 'rejected', 'disqualified', 'withdrawn'];
const SPECIAL_OFFER_ACTIVITY_STATUSES = ['pending', 'approved', 'rejected', 'invalid'];
const SPECIAL_OFFER_ACTIVITY_TYPES = ['share', 'comment'];
const SPECIAL_OFFER_WINNER_AUDIT_ACTIONS = [
  'winner_workflow_started',
  'winner_shortlist_added',
  'winner_shortlist_removed',
  'winner_shortlist_rechecked',
  'winner_primary_selected',
  'winner_backup_selected',
  'winner_contact_started',
  'winner_contact_response_recorded',
  'winner_backup_promoted',
  'winner_confirmed',
  'winner_published',
  'winner_unpublished',
  'winner_workflow_cancelled',
  'winner_workflow_reopened',
];
const SPECIAL_OFFERS_LINK_TYPES = ['cars', 'trips', 'hotels', 'transport', 'shop', 'coupons', 'vip', 'custom'];
const SPECIAL_OFFERS_LINK_MODES = ['main', 'resource', 'custom'];
const SPECIAL_OFFERS_RESOURCE_PICKER_TYPES = ['cars', 'trips', 'hotels', 'transport'];
const SPECIAL_OFFERS_GENERIC_URLS = {
  cars: '/car.html',
  trips: '/trips.html',
  hotels: '/hotels.html',
  transport: '/transport.html',
  vip: '/vip.html',
};
const SPECIAL_OFFERS_PICKER_CONFIG = {
  cars: {
    table: 'car_offers',
    select: 'id, car_model, car_type, location, is_available, price_per_day, price_10plus_days, price_7_10days, price_4_6days, image_url',
    supportsExistingResource: true,
    friendlyError: 'Cars picker is temporarily unavailable because the expected database fields do not match the current schema. Use Main service page for now.',
  },
  trips: {
    table: 'trips',
    select: 'id, slug, title, status, is_published, start_city',
    supportsExistingResource: true,
    friendlyError: 'Trips picker is temporarily unavailable. Use Main service page or Custom URL for now.',
  },
  hotels: {
    table: 'hotels',
    select: 'id, slug, title, status, is_published, city',
    supportsExistingResource: true,
    friendlyError: 'Hotels picker is temporarily unavailable. Use Main service page or Custom URL for now.',
  },
  transport: {
    table: 'transport_routes',
    select: 'id, origin_location_id, destination_location_id, is_active, day_price, night_price, currency',
    supportsExistingResource: true,
    friendlyError: 'Transport route picker needs confirmed public route_id support. Use Main service page for now.',
  },
  shop: {
    supportsExistingResource: false,
    disabledReason: 'Shop picker requires public product URL resolver.',
  },
  coupons: {
    supportsExistingResource: false,
    disabledReason: 'Coupons do not have a clear public URL in this stage.',
  },
  vip: {
    supportsExistingResource: false,
    disabledReason: 'VIP supports Main service page only.',
  },
  custom: {
    supportsExistingResource: false,
    disabledReason: 'Custom links use Custom URL only.',
  },
};
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
const SPECIAL_OFFERS_EDITABLE_STATUSES = ['draft', 'scheduled', 'active', 'ended', 'archived'];
const SPECIAL_OFFERS_VISIBILITIES = ['private', 'public', 'unlisted'];

const SPECIAL_OFFERS_HELP = {
  basic: {
    title: 'Basic settings',
    does: 'Defines the internal campaign identity: slug, type, winner mode, status and visibility.',
    use: 'Use this when creating the campaign shell or preparing a controlled launch. Type options: Contest is a campaign with form and winner, Giveaway is a simpler prize giveaway, Weighted draw is a future points/weights draw, Partner promo is a partner campaign, Coupon promo is a code/coupon promotion, Landing only is an information page without contest mechanics.',
    avoid: 'Do not publish until the existing production Auth flow, campaign dates, rules and privacy links have been confirmed. Archived and locked campaigns remain closed.',
    example: 'Winner mode examples: Manual selection means admin chooses the winner later, Weighted draw is a future weighted draw machine, None means no winner.',
  },
  dates: {
    title: 'Dates & visibility',
    does: 'Stores campaign timing and timezone used by the public page and backend RPC guards.',
    use: 'Use start, end and winner announce dates to prepare or activate the campaign schedule.',
    avoid: 'Do not set Active + Public until production Auth, legal links and the launch checklist are complete.',
    example: 'Example: start in Asia/Nicosia, end after the promotion window, announce after end.',
  },
  content: {
    title: 'Content PL / EN / HE',
    does: 'Stores campaign copy, rules and FAQ separately for Polish, English and Hebrew.',
    use: 'Use these tabs for public campaign content and SEO text in each language.',
    avoid: 'Do not paste raw JSON for FAQ. Use the FAQ builder and rules builder.',
    example: 'Example: PL title is required; EN and HE can be prepared before publication.',
  },
  prize: {
    title: 'Prize',
    does: 'Keeps internal prize details separate from public prize translations.',
    use: 'Use operational fields for sponsor, quantity, value and sort order. Use PL/EN/HE tabs for public prize copy.',
    avoid: 'Do not create separate prize rows for each language.',
    example: 'Example: one prize row with PL, EN and HE name, description, restrictions and fulfillment notes.',
  },
  links: {
    title: 'Linked services',
    does: 'Creates CTA links with language-specific labels, descriptions and URLs.',
    use: 'Link type describes the CTA category. Link mode describes how to link: Main service page means a general page, Existing offer/service means one selected DB resource, Custom URL means a manual link.',
    avoid: 'Do not guess resource IDs. Resource ID is only saved when selected by admin. PL/EN/HE labels and URLs are saved in link translations.',
    example: 'Example: Cars main page creates /car.html?lang=pl, /car.html?lang=en and /car.html?lang=he.',
  },
  form: {
    title: 'Form',
    does: 'Defines the campaign form fields that will be shown later on the public landing.',
    use: 'Use this to prepare field keys, types, required flags, labels, placeholders, help text, options and validation before public submit exists.',
    avoid: 'Do not use this to collect entries yet. This stage only saves form configuration and shows admin preview.',
    example: 'Example: first_name as text, email as email, date_of_birth with min age 18, terms_accepted as consent.',
  },
  requiresForm: {
    title: 'Requires form',
    does: 'Marks that the campaign needs a configured entry form.',
    use: 'Keep this enabled when the campaign should eventually collect participant details.',
    avoid: 'Do not expect this to enable public submit in this stage.',
    example: 'Lefkara requires a form with name, email, phone, date of birth, contest answer and consent.',
  },
  fieldKey: {
    title: 'Field key',
    does: 'Stores the technical identifier used for validation and later entry answers.',
    use: 'Use lowercase letters, numbers and underscores only.',
    avoid: 'Do not translate field keys and do not use spaces or hyphens.',
    example: 'first_name, date_of_birth, contest_answer, terms_accepted.',
  },
  fieldType: {
    title: 'Field type',
    does: 'Controls how the field will render and what validation is expected later.',
    use: 'Choose the closest type: email for email, phone for country-code phone, consent for required terms, select for one choice.',
    avoid: 'Do not create a custom type when an existing type fits.',
    example: 'Use date_of_birth with min age 18 for adult-only campaigns.',
  },
  fieldRequired: {
    title: 'Required',
    does: 'Marks the field as mandatory for future public submit validation.',
    use: 'Enable it for identity, contact, contest proof and consent fields.',
    avoid: 'Do not mark optional admin-only notes as required.',
    example: 'Email and terms_accepted should be required.',
  },
  fieldActive: {
    title: 'Active',
    does: 'Controls whether the field is part of the active form configuration.',
    use: 'Disable a field instead of deleting it when you may need history later.',
    avoid: 'Do not deactivate required legal consent unless the campaign no longer needs a form.',
    example: 'Deactivate an old optional city field while keeping its configuration.',
  },
  fieldValidation: {
    title: 'Validation',
    does: 'Stores field-specific validation settings in a structured way.',
    use: 'Use min age for date of birth, must be true for consent, and min/max length for text fields.',
    avoid: 'Do not edit advanced JSON unless the normal controls cannot express the setting.',
    example: 'date_of_birth min_age = 18; terms_accepted must_be_true = true.',
  },
  fieldOptions: {
    title: 'Options',
    does: 'Defines localized choices for select and checkbox group fields.',
    use: 'Add one value per option and translate its label in PL, EN and HE.',
    avoid: 'Do not use options for normal text, email, phone or URL fields.',
    example: 'value=family, PL label=Rodzina, EN label=Family, HE label=משפחה.',
  },
  formPreview: {
    title: 'Preview form',
    does: 'Shows how the current form configuration will look per language.',
    use: 'Use it before saving to check labels, placeholders, help text, required markers and RTL layout.',
    avoid: 'Do not treat the preview button as a public submit.',
    example: 'Switch to HE preview to verify right-to-left field layout.',
  },
  rules: {
    title: 'Rules/settings',
    does: 'Controls internal campaign behavior flags while the campaign stays private.',
    use: 'Use this for login/form/manual approval flags and entry limits.',
    avoid: 'Do not use advanced JSON unless you know the stored settings object.',
    example: 'Example: requires login, requires form, manual approval, one entry per user.',
  },
  review: {
    title: 'Review & save',
    does: 'Summarizes what will be saved before writing campaign data.',
    use: 'Check translation coverage, prize translations, linked service URLs and warnings before save.',
    avoid: 'Do not save Active + Public until launch gates are complete. Save never creates entries, runs a draw or selects a winner.',
    example: 'Example: one primary CTA with PL/EN/HE URL coverage and a confirmed Active/Public launch window.',
  },
  type: {
    title: 'Campaign type',
    does: 'Classifies what kind of Special Offer this campaign is.',
    use: 'Contest has a form and winner. Giveaway is simpler. Weighted draw is a future weighted/points draw. Partner promo is partner-led. Coupon promo is code-based. Landing only is informational.',
    avoid: 'Do not use type to publish or unlock public mechanics.',
    example: 'Use Contest for Lefkara because it has a campaign form and winner.',
  },
  winnerMode: {
    title: 'Winner mode',
    does: 'Defines how the winner will eventually be selected.',
    use: 'Manual selection means admin chooses. Weighted draw is a future draw with weights. None means no winner.',
    avoid: 'Do not choose Weighted draw expecting a draw machine in this stage.',
    example: 'Use Manual selection for Lefkara so the administrator chooses the winner later.',
  },
  linkType: {
    title: 'Link type',
    does: 'Defines the service category for the CTA.',
    use: 'Choose cars, trips, hotels, transport, VIP or custom depending on where the CTA should lead.',
    avoid: 'Do not choose a category only to force a resource ID. Unsupported pickers stay disabled.',
    example: 'Use Cars for /car.html, Trips for /trips.html or a selected trip slug.',
  },
  linkMode: {
    title: 'Link mode',
    does: 'Defines how this CTA URL is built.',
    use: 'Main service page links to all cars/trips/hotels. Existing offer/service links to one selected DB item. Custom URL is manual.',
    avoid: 'Do not choose Existing offer/service unless the picker is available and you select a resource.',
    example: 'Use Main service page for all cars, Existing offer for a selected trip, Custom URL for a campaign placeholder.',
  },
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

function buildSpecialOfferPublicUrl(campaign, lang = 'pl', { adminPreview = false, clean = false } = {}) {
  const slug = String(campaign?.slug || '').trim();
  if (!slug) return '';
  const language = SPECIAL_OFFERS_DETAIL_LANGUAGES.some((item) => item.code === lang) ? lang : 'pl';
  const params = new URLSearchParams();
  params.set('lang', language);
  if (adminPreview) params.set('admin_preview', '1');
  const path = clean
    ? `/special-offers/${encodeURIComponent(slug)}`
    : `/special-offer.html?slug=${encodeURIComponent(slug)}`;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${params.toString()}`;
}

function buildSpecialOfferPreviewUrl(campaign, lang = 'pl') {
  return buildSpecialOfferPublicUrl(campaign, lang, { adminPreview: true, clean: false });
}

function buildSpecialOfferCleanPublicUrl(campaign, lang = 'pl') {
  return buildSpecialOfferPublicUrl(campaign, lang, { adminPreview: false, clean: true });
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

function groupByParentId(rows, key) {
  return toArray(rows).reduce((acc, row) => {
    const parentId = row?.[key];
    if (!parentId) return acc;
    if (!acc[parentId]) acc[parentId] = [];
    acc[parentId].push(row);
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

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Nicosia',
  }).format(date);
}

function maskEmail(value) {
  const email = String(value || '').trim();
  if (!email || !email.includes('@')) return email ? 'Hidden' : 'Not provided';
  const [local, domain] = email.split('@');
  const safeLocal = local.length <= 2 ? `${local.charAt(0) || '*'}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

function shortId(value) {
  const source = String(value || '').trim();
  return source ? `${source.slice(0, 8)}…` : 'Not set';
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

function getLocalizedRow(rows, lang) {
  const normalizedLang = String(lang || '').trim().toLowerCase();
  return toArray(rows).find((row) => String(row?.lang || '').trim().toLowerCase() === normalizedLang) || null;
}

function getPrizeTranslation(prize, lang) {
  return getLocalizedRow(prize?.translations, lang) || { lang };
}

function getLinkTranslation(link, lang) {
  return getLocalizedRow(link?.translations, lang) || { lang };
}

function getFormFieldTranslation(field, lang) {
  return getLocalizedRow(field?.translations, lang) || { lang, options_json: [] };
}

function appendLangParam(url, lang) {
  const source = String(url || '').trim();
  if (!source) return '';
  if (/([?&])lang=/.test(source)) return source.replace(/([?&])lang=[^&]*/i, `$1lang=${lang}`);
  return `${source}${source.includes('?') ? '&' : '?'}lang=${lang}`;
}

function getGenericUrl(linkType, lang) {
  const base = SPECIAL_OFFERS_GENERIC_URLS[linkType];
  return base ? appendLangParam(base, lang) : '';
}

function isGenericUrlForType(linkType, url) {
  const source = String(url || '').trim();
  const base = SPECIAL_OFFERS_GENERIC_URLS[linkType];
  return Boolean(base && source.startsWith(base) && /([?&])lang=/.test(source));
}

function inferLinkMode(link) {
  if (link?.resource_id) return 'resource';
  if (link?.link_type === 'custom') return 'custom';
  if (isGenericUrlForType(link?.link_type, link?.url)) return 'main';
  return String(link?.url || '').trim() ? 'custom' : 'main';
}

function isValidUrlForStage(url) {
  return /^(\/|https?:\/\/)/i.test(String(url || '').trim());
}

function normalizeOptionalImageUrl(value) {
  const raw = String(value ?? '');
  return raw.trim() ? raw : null;
}

function isValidLinkImageUrl(value) {
  if (value === null || value === undefined || value === '') return true;
  const source = String(value);
  if (!source.trim()) return true;
  if (source.length > 2048) return false;
  if (/[ \t\r\n\f\v\u0000-\u001F\u007F]/.test(source)) return false;
  return /^https:\/\/[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?(?:[/?#][^\s\u0000-\u001F\u007F]*)?$/i.test(source)
    || /^\/[^/\s\u0000-\u001F\u007F?#][^\s\u0000-\u001F\u007F]*$/.test(source);
}

function isValidFormFieldKey(value) {
  return /^[a-z0-9_]+$/.test(String(value || '').trim());
}

function normalizeFormOptions(value) {
  return toArray(value)
    .map((option) => ({
      value: String(option?.value || '').trim(),
      label: String(option?.label || '').trim(),
    }))
    .filter((option) => option.value || option.label);
}

function isOptionFieldType(fieldType) {
  return ['select', 'checkbox_group'].includes(String(fieldType || ''));
}

function isTextValidationFieldType(fieldType) {
  return ['text', 'textarea', 'contest_answer', 'facebook_profile_url', 'shared_post_url', 'url', 'custom'].includes(String(fieldType || ''));
}

function isResourcePickerEnabled(linkType) {
  const type = String(linkType || '');
  const config = SPECIAL_OFFERS_PICKER_CONFIG[type];
  return SPECIAL_OFFERS_RESOURCE_PICKER_TYPES.includes(type)
    && Boolean(config?.supportsExistingResource)
    && !specialOffersState.resourceOptionsErrors[type];
}

function isMainServicePageEnabled(linkType) {
  return Boolean(SPECIAL_OFFERS_GENERIC_URLS[linkType]);
}

function getLanguageDir(lang) {
  return SPECIAL_OFFERS_DETAIL_LANGUAGES.find((item) => item.code === lang)?.dir || 'ltr';
}

function getLanguageLabel(lang) {
  return SPECIAL_OFFERS_DETAIL_LANGUAGES.find((item) => item.code === lang)?.label || String(lang || '').toUpperCase();
}

function countByStatus(campaigns, status) {
  return campaigns.filter((campaign) => campaign.status === status).length;
}

function getCampaignById(offerId) {
  return specialOffersState.campaigns.find((campaign) => String(campaign.id) === String(offerId)) || null;
}

function getEntryStatusTransitions(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['submitted', 'pending_review'].includes(normalized)) return ['approved', 'rejected', 'disqualified'];
  if (['rejected', 'disqualified'].includes(normalized)) return ['pending_review'];
  if (normalized === 'approved') return ['disqualified'];
  return [];
}

function getReviewActionLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'approved') return 'Approve';
  if (normalized === 'rejected') return 'Reject';
  if (normalized === 'disqualified') return 'Disqualify';
  if (normalized === 'pending_review') return 'Back to pending review';
  return titleCase(normalized);
}

function getActivityReviewTransitions(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'pending') return ['approved', 'rejected', 'invalid'];
  if (['rejected', 'invalid'].includes(normalized)) return ['pending'];
  if (normalized === 'approved') return ['invalid', 'pending'];
  return [];
}

function getActivityReviewActionLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'approved') return 'Approve';
  if (normalized === 'rejected') return 'Reject';
  if (normalized === 'invalid') return 'Mark invalid';
  if (normalized === 'pending') return 'Back to pending';
  return titleCase(normalized);
}

function isSafeHttpUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
}

function isValidOfficialPostUrl(value) {
  return isSafeHttpUrl(value);
}

function toLocalDateTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDateTimeInputValue(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function renderSafeExternalLink(url, label = '') {
  const source = String(url || '').trim();
  const text = label || source || 'Not set';
  if (!isSafeHttpUrl(source)) return escapeHtml(text);
  return `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function trapFocusWithin(container, event) {
  if (!container || event.key !== 'Tab') return;
  const focusable = $$('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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
  setStat('entries', Number(specialOffersState.entryCounts.pending_review || 0));
  setStat('winners', 0);
}

function notifySpecialOffers(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  }
}

function getRpcErrorKey(error) {
  return String(error?.message || error?.code || '')
    .split(':')[0]
    .trim()
    .toLowerCase();
}

function logSafeRpcError(context, error) {
  const payload = {
    code: error?.code || '',
    message: error?.message || '',
    details: error?.details || '',
    hint: error?.hint || '',
  };
  if (payload.code || payload.message || payload.details || payload.hint) {
    console.warn(context, payload);
  }
}

function getSpecialOfferDeleteErrorMessage(error, fallback = 'Delete could not be completed.') {
  switch (getRpcErrorKey(error)) {
    case 'entry_reference_mismatch':
      return 'The entry reference confirmation does not match.';
    case 'entry_has_winner_record':
      return 'This entry is linked to a winner record and cannot be deleted.';
    case 'entry_winner_guard_unverifiable':
      return 'Winner safety checks could not be verified.';
    case 'delete_reason_required':
      return 'Permanent delete requires a reason.';
    case 'entry_not_found':
      return 'This entry was not found or was already removed.';
    case 'official_post_must_be_inactive':
      return 'Deactivate the official post before deleting it.';
    case 'official_post_has_activities':
      return 'This post has participant activities. Delete or resolve linked test entries first.';
    case 'official_post_title_mismatch':
      return 'The official post title confirmation does not match.';
    case 'official_post_not_found':
      return 'This official post was not found or was already removed.';
    case 'admin_required':
    case 'login_required':
      return 'Admin access is required for this action.';
    default:
      return fallback;
  }
}

function sanitizeEntrySearch(value) {
  return String(value || '')
    .trim()
    .replace(/[,%]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function applyEntryFilters(query, { status, offerId, search } = {}) {
  if (status && status !== 'all') query = query.eq('status', status);
  if (offerId && offerId !== 'all') query = query.eq('offer_id', offerId);
  const term = sanitizeEntrySearch(search);
  if (term) {
    const pattern = `%${term}%`;
    query = query.or([
      `reference.ilike.${pattern}`,
      `first_name.ilike.${pattern}`,
      `last_name.ilike.${pattern}`,
      `normalized_email.ilike.${pattern}`,
    ].join(','));
  }
  return query;
}

async function countEntriesForFilter(client, filters = {}) {
  const result = await applyEntryFilters(
    client.from('special_offer_entries').select('id', { count: 'exact', head: true }),
    filters
  );
  if (result.error) throw result.error;
  return Number(result.count ?? toArray(result.data).length ?? 0);
}

async function loadEntryCounts(filters = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const baseFilters = { offerId: filters.offerId || 'all', search: filters.search || '' };
  const entries = await Promise.all([
    ['total', countEntriesForFilter(client, { ...baseFilters, status: 'all' })],
    ...SPECIAL_OFFER_ENTRY_STATUSES.map((status) => [status, countEntriesForFilter(client, { ...baseFilters, status })]),
  ].map(async ([key, promise]) => [key, await promise]));
  return Object.fromEntries(entries);
}

async function loadEntriesPage() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const filters = specialOffersState.entries;
  const from = (Math.max(1, Number(filters.page || 1)) - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const query = applyEntryFilters(
    client.from('special_offer_entries').select(SPECIAL_OFFER_ENTRIES_LIST_SELECT, { count: 'exact' }),
    filters
  )
    .order('created_at', { ascending: false })
    .range(from, to);
  const result = await query;
  if (result.error) throw result.error;
  return {
    rows: toArray(result.data),
    total: Number(result.count ?? toArray(result.data).length ?? 0),
  };
}

async function refreshEntryStatsForShell() {
  try {
    specialOffersState.entryCounts = await loadEntryCounts();
  } catch (error) {
    specialOffersState.entryCounts = {};
  }
}

async function loadEntryDetail(entryId) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const [entryResult, answersResult, auditResult, activitiesResult, scoreResult] = await Promise.all([
    client.from('special_offer_entries').select(SPECIAL_OFFER_ENTRIES_DETAIL_SELECT).eq('id', entryId).single(),
    client.from('special_offer_entry_answers').select(SPECIAL_OFFER_ENTRY_ANSWERS_SELECT).eq('entry_id', entryId).order('created_at', { ascending: true }),
    client.from('special_offer_audit_log').select(SPECIAL_OFFERS_AUDIT_SELECT).eq('entity_type', 'special_offer_entry').eq('entity_id', entryId).order('created_at', { ascending: false }).limit(20),
    client.from('special_offer_entry_activities').select(SPECIAL_OFFER_ACTIVITIES_SELECT).eq('entry_id', entryId).order('created_at', { ascending: false }),
    client.rpc('special_offer_entry_score_summary', { p_offer_id: null, p_entry_id: entryId }),
  ]);
  if (entryResult.error) throw entryResult.error;
  if (answersResult.error) throw answersResult.error;
  if (auditResult.error) throw auditResult.error;
  const activities = activitiesResult.error ? [] : toArray(activitiesResult.data);
  const [winnerShortlistResult, winnerContactsResult, winnerPublicationsResult, winnerWorkflowsResult] = await Promise.all([
    client.from('special_offer_winner_shortlist').select(SPECIAL_OFFER_WINNER_SHORTLIST_SELECT).eq('entry_id', entryId).order('created_at', { ascending: false }),
    client.from('special_offer_winner_contact_events').select(SPECIAL_OFFER_WINNER_CONTACT_EVENTS_SELECT).eq('entry_id', entryId).order('created_at', { ascending: false }),
    client.from('special_offer_winner_publications').select(SPECIAL_OFFER_WINNER_PUBLICATIONS_SELECT).eq('entry_id', entryId).order('published_at', { ascending: false }),
    client.from('special_offer_winner_workflows').select(SPECIAL_OFFER_WINNER_WORKFLOWS_SELECT).eq('offer_id', entryResult.data.offer_id).order('created_at', { ascending: false }),
  ]);
  const officialPostIds = [...new Set(activities.map((row) => row.official_post_id).filter(Boolean))];
  let postsById = {};
  if (officialPostIds.length) {
    const postsResult = await client.from('special_offer_official_posts').select(SPECIAL_OFFER_OFFICIAL_POSTS_SELECT).in('id', officialPostIds);
    if (!postsResult.error) {
      postsById = Object.fromEntries(toArray(postsResult.data).map((row) => [row.id, row]));
    }
  }
  return {
    entry: entryResult.data,
    answers: toArray(answersResult.data),
    auditLog: toArray(auditResult.data),
    activities,
    activityPostsById: postsById,
    score: scoreResult.error ? null : toArray(scoreResult.data)[0] || null,
    winnerSelection: {
      shortlist: winnerShortlistResult.error ? [] : toArray(winnerShortlistResult.data),
      contacts: winnerContactsResult.error ? [] : toArray(winnerContactsResult.data),
      publications: winnerPublicationsResult.error ? [] : toArray(winnerPublicationsResult.data),
      workflows: winnerWorkflowsResult.error ? [] : toArray(winnerWorkflowsResult.data),
    },
  };
}

function applyActivityFilters(query, { offerId, status, activityType, officialPostId, search } = {}) {
  if (offerId && offerId !== 'all') query = query.eq('offer_id', offerId);
  if (status && status !== 'all') query = query.eq('status', status);
  if (activityType && activityType !== 'all') query = query.eq('activity_type', activityType);
  if (officialPostId && officialPostId !== 'all') query = query.eq('official_post_id', officialPostId);
  return query;
}

async function getEntryIdsForActivitySearch(client, search) {
  const term = sanitizeEntrySearch(search);
  if (!term) return null;
  const pattern = `%${term}%`;
  const result = await client
    .from('special_offer_entries')
    .select('id')
    .or([
      `reference.ilike.${pattern}`,
      `first_name.ilike.${pattern}`,
      `last_name.ilike.${pattern}`,
      `normalized_email.ilike.${pattern}`,
    ].join(','))
    .limit(200);
  if (result.error) throw result.error;
  return toArray(result.data).map((row) => row.id).filter(Boolean);
}

async function loadOfficialPosts(offerId = 'all') {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  let query = client.from('special_offer_official_posts').select(SPECIAL_OFFER_OFFICIAL_POSTS_SELECT);
  if (offerId && offerId !== 'all') query = query.eq('offer_id', offerId);
  const result = await query.order('post_order', { ascending: true });
  if (result.error) throw result.error;
  return toArray(result.data);
}

async function loadOfficialPostActivityCounts(posts = []) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const pairs = await Promise.all(toArray(posts).map(async (post) => {
    if (!post?.id) return [post?.id, 0];
    const result = await client
      .from('special_offer_entry_activities')
      .select('id', { count: 'exact', head: true })
      .eq('official_post_id', post.id);
    if (result.error) throw result.error;
    return [post.id, Number(result.count ?? toArray(result.data).length ?? 0)];
  }));
  return Object.fromEntries(pairs.filter(([id]) => Boolean(id)));
}

async function countActivitiesForFilter(client, filters = {}) {
  const entryIds = await getEntryIdsForActivitySearch(client, filters.search);
  if (Array.isArray(entryIds) && !entryIds.length) return 0;
  let query = applyActivityFilters(
    client.from('special_offer_entry_activities').select('id', { count: 'exact', head: true }),
    filters
  );
  if (Array.isArray(entryIds)) query = query.in('entry_id', entryIds);
  const result = await query;
  if (result.error) throw result.error;
  return Number(result.count ?? toArray(result.data).length ?? 0);
}

async function loadActivityCounts(filters = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const baseFilters = {
    offerId: filters.offerId || 'all',
    activityType: filters.activityType || 'all',
    officialPostId: filters.officialPostId || 'all',
    search: filters.search || '',
  };
  const pairs = await Promise.all([
    ['total', countActivitiesForFilter(client, { ...baseFilters, status: 'all' })],
    ...SPECIAL_OFFER_ACTIVITY_STATUSES.map((status) => [status, countActivitiesForFilter(client, { ...baseFilters, status })]),
    ...SPECIAL_OFFER_ACTIVITY_TYPES.map((activityType) => [activityType, countActivitiesForFilter(client, { ...baseFilters, status: filters.status || 'all', activityType })]),
  ].map(async ([key, promise]) => [key, await promise]));
  return Object.fromEntries(pairs);
}

async function loadActivitiesPage() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const state = specialOffersState.manualVerification.activities;
  const filters = {
    offerId: specialOffersState.manualVerification.offerId,
    status: state.status,
    activityType: state.activityType,
    officialPostId: state.officialPostId,
    search: state.search,
  };
  const from = (Math.max(1, Number(state.page || 1)) - 1) * state.pageSize;
  const to = from + state.pageSize - 1;
  const matchingEntryIds = await getEntryIdsForActivitySearch(client, filters.search);
  if (Array.isArray(matchingEntryIds) && !matchingEntryIds.length) {
    return { rows: [], entriesById: {}, postsById: {}, total: 0 };
  }
  let query = applyActivityFilters(
    client.from('special_offer_entry_activities').select(SPECIAL_OFFER_ACTIVITIES_SELECT, { count: 'exact' }),
    filters
  );
  if (Array.isArray(matchingEntryIds)) query = query.in('entry_id', matchingEntryIds);
  const result = await query.order('created_at', { ascending: false }).range(from, to);
  if (result.error) throw result.error;
  const rows = toArray(result.data);
  const entryIds = [...new Set(rows.map((row) => row.entry_id).filter(Boolean))];
  const postIds = [...new Set(rows.map((row) => row.official_post_id).filter(Boolean))];
  const [entriesResult, postsResult] = await Promise.all([
    entryIds.length
      ? client.from('special_offer_entries').select(SPECIAL_OFFER_ENTRIES_LIST_SELECT).in('id', entryIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? client.from('special_offer_official_posts').select(SPECIAL_OFFER_OFFICIAL_POSTS_SELECT).in('id', postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (postsResult.error) throw postsResult.error;
  return {
    rows,
    entriesById: Object.fromEntries(toArray(entriesResult.data).map((row) => [row.id, row])),
    postsById: Object.fromEntries(toArray(postsResult.data).map((row) => [row.id, row])),
    total: Number(result.count ?? rows.length ?? 0),
  };
}

async function loadActivityDetail(activityId) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const activityResult = await client.from('special_offer_entry_activities').select(SPECIAL_OFFER_ACTIVITIES_SELECT).eq('id', activityId).single();
  if (activityResult.error) throw activityResult.error;
  const activity = activityResult.data;
  const [entryResult, postResult, auditResult, scoreResult] = await Promise.all([
    client.from('special_offer_entries').select(SPECIAL_OFFER_ENTRIES_DETAIL_SELECT).eq('id', activity.entry_id).single(),
    client.from('special_offer_official_posts').select(SPECIAL_OFFER_OFFICIAL_POSTS_SELECT).eq('id', activity.official_post_id).single(),
    client.from('special_offer_audit_log').select(SPECIAL_OFFERS_AUDIT_SELECT).eq('entity_type', 'special_offer_entry_activity').eq('entity_id', activity.id).order('created_at', { ascending: false }).limit(20),
    client.rpc('special_offer_entry_score_summary', { p_offer_id: activity.offer_id, p_entry_id: activity.entry_id }),
  ]);
  if (entryResult.error) throw entryResult.error;
  if (postResult.error) throw postResult.error;
  if (auditResult.error) throw auditResult.error;
  return {
    activity,
    entry: entryResult.data,
    post: postResult.data,
    auditLog: toArray(auditResult.data),
    score: scoreResult.error ? null : toArray(scoreResult.data)[0] || null,
  };
}

async function loadScoreForEntry(client, offerId, entryId) {
  if (!entryId) return null;
  const result = await client.rpc('special_offer_entry_score_summary', {
    p_offer_id: offerId || null,
    p_entry_id: entryId,
  });
  if (result.error) return null;
  return toArray(result.data)[0] || null;
}

function getActiveWinnerWorkflow(workflows = []) {
  return toArray(workflows).find((workflow) => String(workflow.status || '') !== 'cancelled') || null;
}

function getWinnerWorkflowBlockingReasons(readiness) {
  const raw = String(readiness?.blocking_reason || '').trim();
  if (!raw) return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function buildManualWinnerLoadError(result, failedStep, fallbackMessage = 'Manual Winner Selection could not be loaded.') {
  const source = result?.error || result || {};
  const error = new Error(source.message || fallbackMessage);
  error.code = source.code || '';
  error.details = source.details || '';
  error.hint = source.hint || '';
  error.failedStep = failedStep;
  return error;
}

function assertManualWinnerResult(result, failedStep) {
  if (result?.error) throw buildManualWinnerLoadError(result, failedStep);
  return result;
}

function getManualWinnerErrorMeta(error) {
  return {
    failedStep: String(error?.failedStep || 'manual winner selection load').trim(),
    code: String(error?.code || '').trim(),
  };
}

function renderManualWinnerLoadError() {
  const state = specialOffersState.manualWinner;
  const meta = state.errorMeta || {};
  return `
    <div class="special-offer-entry-state special-offer-entry-state--error">
      <strong>${escapeHtml(state.error || 'Unable to load Manual Winner Selection.')}</strong>
      <p>Failed step: ${escapeHtml(meta.failedStep || 'manual winner selection load')}.</p>
      ${meta.code ? `<p>Error code: ${escapeHtml(meta.code)}.</p>` : ''}
    </div>
  `;
}

async function loadManualWinnerData(offerId) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available.');
  const selectedOfferId = offerId && offerId !== 'all' ? offerId : specialOffersState.campaigns[0]?.id || '';
  if (!selectedOfferId) {
    return {
      readiness: null,
      workflows: [],
      activeWorkflow: null,
      shortlist: [],
      contacts: [],
      publications: [],
      eligibleEntries: [],
      entriesById: {},
      scoresByEntryId: {},
      activitiesByEntryId: {},
      auditLog: [],
    };
  }

  const [
    readinessResult,
    workflowsResult,
    allEntriesResult,
    activitiesResult,
    publicationsResult,
    auditResult,
  ] = await Promise.all([
    client.rpc('special_offer_winner_workflow_readiness', { p_offer_id: selectedOfferId }),
    client.from('special_offer_winner_workflows').select(SPECIAL_OFFER_WINNER_WORKFLOWS_SELECT).eq('offer_id', selectedOfferId).order('created_at', { ascending: false }),
    client.from('special_offer_entries').select(SPECIAL_OFFER_ENTRIES_LIST_SELECT).eq('offer_id', selectedOfferId).order('created_at', { ascending: true }),
    client.from('special_offer_entry_activities').select(SPECIAL_OFFER_ACTIVITIES_SELECT).eq('offer_id', selectedOfferId).order('created_at', { ascending: false }),
    client.from('special_offer_winner_publications').select(SPECIAL_OFFER_WINNER_PUBLICATIONS_SELECT).eq('offer_id', selectedOfferId).order('published_at', { ascending: false }),
    client.from('special_offer_audit_log').select(SPECIAL_OFFERS_AUDIT_SELECT).eq('offer_id', selectedOfferId).in('action', SPECIAL_OFFER_WINNER_AUDIT_ACTIONS).order('created_at', { ascending: false }).limit(50),
  ]);

  assertManualWinnerResult(readinessResult, 'winner workflow readiness');
  assertManualWinnerResult(workflowsResult, 'winner workflows load');
  assertManualWinnerResult(allEntriesResult, 'winner entries load');
  assertManualWinnerResult(activitiesResult, 'winner activities load');
  assertManualWinnerResult(publicationsResult, 'winner publications load');
  assertManualWinnerResult(auditResult, 'winner audit load');

  const workflows = toArray(workflowsResult.data);
  const activeWorkflow = getActiveWinnerWorkflow(workflows);
  let shortlist = [];
  let contacts = [];
  if (activeWorkflow?.id) {
    const [shortlistResult, contactsResult] = await Promise.all([
      client.from('special_offer_winner_shortlist').select(SPECIAL_OFFER_WINNER_SHORTLIST_SELECT).eq('workflow_id', activeWorkflow.id).order('added_at', { ascending: true }),
      client.from('special_offer_winner_contact_events').select(SPECIAL_OFFER_WINNER_CONTACT_EVENTS_SELECT).eq('workflow_id', activeWorkflow.id).order('created_at', { ascending: false }),
    ]);
    assertManualWinnerResult(shortlistResult, 'winner shortlist load');
    assertManualWinnerResult(contactsResult, 'winner contact events load');
    shortlist = toArray(shortlistResult.data);
    contacts = toArray(contactsResult.data);
  }

  const entries = toArray(allEntriesResult.data);
  const activeShortlistEntryIds = new Set(
    shortlist
      .filter((row) => ['active', 'needs_recheck'].includes(String(row.status || '')))
      .map((row) => String(row.entry_id))
  );
  const eligibleEntries = entries.filter((entry) => (
    String(entry.status || '') === 'approved'
    && !activeShortlistEntryIds.has(String(entry.id))
  ));
  const entryIds = [...new Set([
    ...entries.map((entry) => entry.id),
    ...shortlist.map((row) => row.entry_id),
  ].filter(Boolean))];
  const scores = await Promise.all(entryIds.map(async (entryId) => [entryId, await loadScoreForEntry(client, selectedOfferId, entryId)]));
  const activitiesByEntryId = groupByParentId(toArray(activitiesResult.data), 'entry_id');
  return {
    readiness: toArray(readinessResult.data)[0] || null,
    workflows,
    activeWorkflow,
    shortlist,
    contacts,
    publications: toArray(publicationsResult.data),
    eligibleEntries,
    entriesById: Object.fromEntries(entries.map((row) => [row.id, row])),
    scoresByEntryId: Object.fromEntries(scores),
    activitiesByEntryId,
    auditLog: toArray(auditResult.data),
  };
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
  const canEdit = isCampaignEditableInAdmin(campaign);
  const publicUrl = buildSpecialOfferCleanPublicUrl(campaign, 'pl');
  const previewUrl = buildSpecialOfferPreviewUrl(campaign, 'pl');

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
        <button class="btn-secondary btn-small" type="button" data-special-offers-open-entries="${escapeHtml(campaign.id)}">Entries</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-open-manual-verification="${escapeHtml(campaign.id)}">Manual verification</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-open-manual-winner="${escapeHtml(campaign.id)}" ${campaign.winner_selection_mode === 'manual_selection' ? '' : 'disabled title="Manual winner selection requires winner_selection_mode = manual_selection."'}>Manual winner selection</button>
        <a class="btn-secondary btn-small" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener noreferrer" data-special-offers-public-url="${escapeHtml(publicUrl)}">Preview public page</a>
        <a class="btn-secondary btn-small" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer" data-special-offers-preview-url="${escapeHtml(previewUrl)}">Admin preview</a>
        <button class="btn-secondary btn-small" type="button" data-special-offers-copy-preview-url="${escapeHtml(campaign.id)}">Copy admin preview URL</button>
        <button
          class="btn-primary btn-small"
          type="button"
          data-special-offers-edit="${escapeHtml(campaign.id)}"
          ${canEdit ? '' : 'disabled title="Archived or locked campaigns cannot be edited."'}
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

function renderEntryCounts(counts = specialOffersState.entryCounts) {
  const items = [
    ['total', 'Total'],
    ['submitted', 'Submitted'],
    ['pending_review', 'Pending review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['disqualified', 'Disqualified'],
    ['withdrawn', 'Withdrawn'],
  ];
  return `
    <div class="special-offer-entry-counts" aria-label="Entry status counts">
      ${items.map(([key, label]) => `
        <span class="special-offer-entry-count">
          <strong>${escapeHtml(String(Number(counts?.[key] || 0)))}</strong>
          ${escapeHtml(label)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderEntryFilters() {
  const filters = specialOffersState.entries;
  return `
    <div class="special-offer-entry-filters">
      <label>
        Search
        <input type="search" value="${escapeHtml(filters.search)}" placeholder="Reference, name or email" data-special-offers-entry-search />
      </label>
      <label>
        Status
        <select data-special-offers-entry-status>
          <option value="all"${filters.status === 'all' ? ' selected' : ''}>All statuses</option>
          ${SPECIAL_OFFER_ENTRY_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${filters.status === status ? ' selected' : ''}>${escapeHtml(titleCase(status))}</option>`).join('')}
        </select>
      </label>
      <label>
        Campaign
        <select data-special-offers-entry-offer>
          <option value="all"${filters.offerId === 'all' ? ' selected' : ''}>All campaigns</option>
          ${specialOffersState.campaigns.map((campaign) => `<option value="${escapeHtml(campaign.id)}"${String(filters.offerId) === String(campaign.id) ? ' selected' : ''}>${escapeHtml(formatCampaignTitle(campaign))}</option>`).join('')}
        </select>
      </label>
      <button class="btn-secondary btn-small" type="button" data-special-offers-entry-refresh>Refresh</button>
    </div>
  `;
}

function renderEntryRows() {
  const rows = toArray(specialOffersState.entries.rows);
  if (specialOffersState.entries.loading) {
    return '<div class="special-offer-entry-state">Loading entries...</div>';
  }
  if (specialOffersState.entries.error) {
    return `<div class="special-offer-entry-state special-offer-entry-state--error">${escapeHtml(specialOffersState.entries.error)}</div>`;
  }
  if (!rows.length) {
    return '<div class="special-offer-entry-state">No entries match the current filters.</div>';
  }
  return `
    <div class="special-offer-entry-table-wrap">
      <table class="special-offer-entry-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Reviewed</th>
            <th>Participant</th>
            <th>Language</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const participant = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || maskEmail(row.normalized_email);
            return `
              <tr data-special-offers-entry-row="${escapeHtml(row.id)}">
                <td><strong>${escapeHtml(row.reference || shortId(row.id))}</strong></td>
                <td>${renderStatusChip(row.status, 'entry-status')}</td>
                <td>${escapeHtml(formatDateTime(row.created_at))}</td>
                <td>${escapeHtml(formatDateTime(row.reviewed_at))}</td>
                <td>${escapeHtml(participant)}</td>
                <td>${escapeHtml(String(row.submitted_lang || '').toUpperCase() || '—')}</td>
                <td><button class="btn-secondary btn-small" type="button" data-special-offers-entry-detail="${escapeHtml(row.id)}">Details</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEntriesPagination() {
  const state = specialOffersState.entries;
  const totalPages = Math.max(1, Math.ceil(Number(state.total || 0) / state.pageSize));
  return `
    <div class="special-offer-entry-pagination">
      <button class="btn-secondary btn-small" type="button" data-special-offers-entry-page="prev" ${state.page <= 1 || state.loading ? 'disabled' : ''}>Previous</button>
      <span>Page ${escapeHtml(String(state.page))} of ${escapeHtml(String(totalPages))} · ${escapeHtml(String(state.total || 0))} total</span>
      <button class="btn-secondary btn-small" type="button" data-special-offers-entry-page="next" ${state.page >= totalPages || state.loading ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function renderEntriesModalBody() {
  return `
    ${renderEntryCounts(specialOffersState.entryCounts)}
    ${renderEntryFilters()}
    ${renderEntryRows()}
    ${renderEntriesPagination()}
  `;
}

function renderManualVerificationNotice() {
  return `
    <div class="special-offer-manual-notice" role="note">
      <strong>Manual selection remains active.</strong>
      Points are a supporting criterion for the administrator. This panel does not select winners automatically, run a draw or publish results.
    </div>
  `;
}

function renderManualVerificationFilters() {
  const state = specialOffersState.manualVerification;
  const activities = state.activities;
  const posts = toArray(state.posts).filter((post) => state.offerId === 'all' || String(post.offer_id) === String(state.offerId));
  return `
    <div class="special-offer-entry-filters">
      <label>
        Campaign
        <select data-special-offers-manual-offer>
          <option value="all"${state.offerId === 'all' ? ' selected' : ''}>All campaigns</option>
          ${specialOffersState.campaigns.map((campaign) => `<option value="${escapeHtml(campaign.id)}"${String(state.offerId) === String(campaign.id) ? ' selected' : ''}>${escapeHtml(formatCampaignTitle(campaign))}</option>`).join('')}
        </select>
      </label>
      <label>
        Official post
        <select data-special-offers-activity-post>
          <option value="all"${activities.officialPostId === 'all' ? ' selected' : ''}>All posts</option>
          ${posts.map((post) => `<option value="${escapeHtml(post.id)}"${String(activities.officialPostId) === String(post.id) ? ' selected' : ''}>${escapeHtml(`#${post.post_order} ${post.admin_title}`)}</option>`).join('')}
        </select>
      </label>
      <label>
        Type
        <select data-special-offers-activity-type>
          <option value="all"${activities.activityType === 'all' ? ' selected' : ''}>All types</option>
          ${SPECIAL_OFFER_ACTIVITY_TYPES.map((type) => `<option value="${escapeHtml(type)}"${activities.activityType === type ? ' selected' : ''}>${escapeHtml(titleCase(type))}</option>`).join('')}
        </select>
      </label>
      <label>
        Status
        <select data-special-offers-activity-status>
          <option value="all"${activities.status === 'all' ? ' selected' : ''}>All statuses</option>
          ${SPECIAL_OFFER_ACTIVITY_STATUSES.map((status) => `<option value="${escapeHtml(status)}"${activities.status === status ? ' selected' : ''}>${escapeHtml(titleCase(status))}</option>`).join('')}
        </select>
      </label>
      <label>
        Search
        <input type="search" value="${escapeHtml(activities.search)}" placeholder="Entry reference or participant" data-special-offers-activity-search />
      </label>
      <button class="btn-secondary btn-small" type="button" data-special-offers-manual-refresh>Refresh</button>
    </div>
  `;
}

function renderManualActivityCounts(counts = specialOffersState.manualVerification.counts) {
  const items = [
    ['total', 'Total'],
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['invalid', 'Invalid'],
    ['share', 'Shares'],
    ['comment', 'Comments'],
  ];
  return `
    <div class="special-offer-entry-counts" aria-label="Activity status counts">
      ${items.map(([key, label]) => `
        <span class="special-offer-entry-count">
          <strong>${escapeHtml(String(Number(counts?.[key] || 0)))}</strong>
          ${escapeHtml(label)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderOfficialPostsSection() {
  const state = specialOffersState.manualVerification;
  const rows = toArray(state.posts).filter((post) => state.offerId === 'all' || String(post.offer_id) === String(state.offerId));
  const editPost = state.postEditingId
    ? rows.find((post) => String(post.id) === String(state.postEditingId)) || null
    : null;
  const formPost = editPost || {
    post_order: rows.length + 1,
    platform: 'facebook',
    published_at: '',
    comment_deadline_at: '',
    active: true,
  };
  return `
    <section class="special-offers-detail-panel special-offers-detail-panel--wide">
      <div class="special-offer-entry-section-heading">
        <div>
          <h4>Official posts</h4>
          <p class="special-offer-editor-muted">Official posts define weekly share/comment evidence targets. Deactivation blocks new claims but keeps historic points.</p>
        </div>
        <button class="btn-secondary btn-small" type="button" data-special-offers-post-new>Add official post</button>
      </div>
      ${state.postsLoading ? '<div class="special-offer-entry-state">Loading official posts...</div>' : ''}
      ${state.postsError ? `<div class="special-offer-entry-state special-offer-entry-state--error">${escapeHtml(state.postsError)}</div>` : ''}
      ${rows.length ? `
        <div class="special-offer-entry-table-wrap">
          <table class="special-offer-entry-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Week</th>
                <th>Title</th>
                <th>Platform</th>
                <th>URL</th>
                <th>Published</th>
                <th>Comment deadline</th>
                <th>Active</th>
                <th>Activities</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((post) => {
                const activityCount = Number(state.postActivityCounts?.[post.id] || 0);
                return `
                  <tr>
                    <td>${escapeHtml(post.post_order)}</td>
                    <td>${escapeHtml(post.week_number ?? '—')}</td>
                    <td><strong>${escapeHtml(post.admin_title)}</strong></td>
                    <td>${escapeHtml(titleCase(post.platform))}</td>
                    <td>${renderSafeExternalLink(post.official_url, 'Open post')}</td>
                    <td>${escapeHtml(formatDateTime(post.published_at))}</td>
                    <td>${escapeHtml(formatDateTime(post.comment_deadline_at))}</td>
                    <td>${post.active ? 'Yes' : 'No'}</td>
                    <td>${escapeHtml(String(activityCount))}</td>
                    <td>
                      <button class="btn-secondary btn-small" type="button" data-special-offers-post-edit="${escapeHtml(post.id)}">Edit</button>
                      ${post.active
                        ? `<button class="btn-secondary btn-small" type="button" data-special-offers-post-deactivate="${escapeHtml(post.id)}">Deactivate</button>`
                        : activityCount > 0
                          ? '<button class="btn-secondary btn-small" type="button" disabled title="This post has participant activities. Delete or resolve linked test entries first.">Delete unavailable</button>'
                          : `<button class="btn-danger btn-small" type="button" data-special-offers-post-delete="${escapeHtml(post.id)}">Delete permanently</button>`}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="special-offers-empty-copy">No official posts are configured for the current campaign filter.</p>'}
      ${state.postEditingId !== '' ? renderOfficialPostForm(formPost, Boolean(editPost)) : ''}
    </section>
  `;
}

function renderOfficialPostForm(post, isEdit = false) {
  const selectedOfferId = post.offer_id || (specialOffersState.manualVerification.offerId !== 'all' ? specialOffersState.manualVerification.offerId : specialOffersState.campaigns[0]?.id || '');
  return `
    <form class="special-offer-entry-review-form special-offer-post-form" data-special-offers-post-form>
      <h5>${isEdit ? 'Edit official post' : 'Add official post'}</h5>
      <div class="special-offer-editor-grid">
        <label>
          Campaign
          <select name="offer_id" ${isEdit ? 'disabled' : ''}>
            ${specialOffersState.campaigns.map((campaign) => `<option value="${escapeHtml(campaign.id)}"${String(selectedOfferId) === String(campaign.id) ? ' selected' : ''}>${escapeHtml(formatCampaignTitle(campaign))}</option>`).join('')}
          </select>
        </label>
        <label>
          Platform
          <select name="platform">
            <option value="facebook"${String(post.platform || '').toLowerCase() === 'facebook' ? ' selected' : ''}>Facebook</option>
          </select>
        </label>
        <label>
          Post order *
          <input name="post_order" type="number" min="1" required value="${escapeHtml(post.post_order ?? '')}" />
        </label>
        <label>
          Week number
          <input name="week_number" type="number" min="1" value="${escapeHtml(post.week_number ?? '')}" />
        </label>
        <label class="special-offer-editor-field--wide">
          Admin title *
          <input name="admin_title" type="text" maxlength="180" required value="${escapeHtml(post.admin_title || '')}" />
        </label>
        <label class="special-offer-editor-field--wide">
          Official URL *
          <input name="official_url" type="url" required value="${escapeHtml(post.official_url || '')}" />
          <small>Only http:// or https:// URLs are accepted. No Open Graph fetch is performed.</small>
        </label>
        <label>
          Published at *
          <input name="published_at" type="datetime-local" required value="${escapeHtml(toLocalDateTimeInputValue(post.published_at))}" />
        </label>
        <label>
          Comment deadline
          <input name="comment_deadline_at" type="datetime-local" value="${escapeHtml(toLocalDateTimeInputValue(post.comment_deadline_at))}" />
          <small>Leave empty to let the RPC use published_at + 24 hours.</small>
        </label>
        <label class="special-offer-editor-field--wide">
          External post ID
          <input name="external_post_id" type="text" maxlength="240" value="${escapeHtml(post.external_post_id || '')}" />
        </label>
      </div>
      <div class="special-offer-entry-review-footer">
        <button class="btn-primary btn-small" type="submit" ${specialOffersState.manualVerification.postSaving ? 'disabled' : ''}>Save official post</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-post-cancel>Cancel</button>
      </div>
      <p class="special-offer-editor-muted">This saves through admin_upsert_special_offer_official_post only.</p>
    </form>
  `;
}

function ensureOfficialPostDeleteModal() {
  let modal = $('#specialOfferOfficialPostDeleteModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-entry-detail-modal';
  modal.id = 'specialOfferOfficialPostDeleteModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-post-delete-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOfferOfficialPostDeleteTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Permanent delete</div>
          <h3 id="specialOfferOfficialPostDeleteTitle">Delete official post permanently</h3>
          <p class="special-offer-editor-subtitle">Only inactive posts with zero participant activities can be deleted.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-post-delete-close aria-label="Close official post delete">×</button>
      </header>
      <div class="admin-modal-body" id="specialOfferOfficialPostDeleteBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-post-delete-close]')) closeOfficialPostDeleteModal();
  });
  modal.addEventListener('submit', (event) => {
    const form = event.target instanceof Element ? event.target.closest('[data-special-offers-post-delete-form]') : null;
    if (!form) return;
    event.preventDefault();
    submitOfficialPostDelete(form);
  });
  return modal;
}

function renderOfficialPostDeleteModal() {
  const modal = ensureOfficialPostDeleteModal();
  const body = $('#specialOfferOfficialPostDeleteBody', modal);
  const postId = specialOffersState.manualVerification.postDelete.postId;
  const post = toArray(specialOffersState.manualVerification.posts).find((row) => String(row.id) === String(postId));
  const activityCount = Number(specialOffersState.manualVerification.postActivityCounts?.[postId] || 0);
  if (!body) return;
  if (!post) {
    body.innerHTML = '<div class="special-offer-entry-state special-offer-entry-state--error">Official post is no longer available.</div>';
    modal.hidden = false;
    return;
  }
  body.innerHTML = `
    <form class="special-offer-entry-delete-form" data-special-offers-post-delete-form>
      <p class="special-offer-editor-warning">This operation is irreversible. It deletes the official post only. It does not delete the campaign, entries, participants or activities.</p>
      <div class="special-offer-entry-state">
        <strong>${escapeHtml(post.admin_title)}</strong><br>
        Active: ${post.active ? 'Yes' : 'No'} · Activities: ${escapeHtml(String(activityCount))}
      </div>
      ${specialOffersState.manualVerification.postDelete.error ? `<div class="special-offer-entry-state special-offer-entry-state--error">${escapeHtml(specialOffersState.manualVerification.postDelete.error)}</div>` : ''}
      <label>Reason *
        <textarea name="delete_reason" rows="3" maxlength="1000" required placeholder="Internal reason for permanent deletion"></textarea>
      </label>
      <label>Type the exact admin title to confirm *
        <input name="expected_admin_title" required autocomplete="off" placeholder="${escapeHtml(post.admin_title || '')}" />
      </label>
      <div class="special-offer-editor-actions">
        <button class="btn-danger btn-small" type="submit" ${specialOffersState.manualVerification.postDelete.deleting ? 'disabled' : ''}>Delete permanently</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-post-delete-close ${specialOffersState.manualVerification.postDelete.deleting ? 'disabled' : ''}>Cancel</button>
      </div>
    </form>
  `;
  modal.hidden = false;
}

function openOfficialPostDeleteModal(postId, trigger = null) {
  specialOffersState.manualVerification.postDelete.postId = postId || '';
  specialOffersState.manualVerification.postDelete.error = '';
  specialOffersState.manualVerification.postDelete.lastTrigger = trigger || document.activeElement || null;
  renderOfficialPostDeleteModal();
}

function closeOfficialPostDeleteModal() {
  const modal = $('#specialOfferOfficialPostDeleteModal');
  if (modal) modal.hidden = true;
  specialOffersState.manualVerification.postDelete.postId = '';
  specialOffersState.manualVerification.postDelete.deleting = false;
  specialOffersState.manualVerification.postDelete.error = '';
  const trigger = specialOffersState.manualVerification.postDelete.lastTrigger;
  specialOffersState.manualVerification.postDelete.lastTrigger = null;
  if (trigger && typeof trigger.focus === 'function') {
    try {
      trigger.focus();
    } catch (_error) {
      // ignore focus restoration failures
    }
  }
}

function renderActivityQueue() {
  const state = specialOffersState.manualVerification.activities;
  const rows = toArray(state.rows);
  if (state.loading) return '<div class="special-offer-entry-state">Loading activity claims...</div>';
  if (state.error) return `<div class="special-offer-entry-state special-offer-entry-state--error">${escapeHtml(state.error)}</div>`;
  if (!rows.length) return '<div class="special-offer-entry-state">No activity claims match the current filters.</div>';
  return `
    <div class="special-offer-entry-table-wrap">
      <table class="special-offer-entry-table">
        <thead>
          <tr>
            <th>Entry</th>
            <th>Official post</th>
            <th>Type</th>
            <th>Status</th>
            <th>Points</th>
            <th>Reported</th>
            <th>Verified activity</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const entry = state.entriesById[row.entry_id] || {};
            const post = state.postsById[row.official_post_id] || {};
            return `
              <tr data-special-offers-activity-row="${escapeHtml(row.id)}">
                <td><strong>${escapeHtml(entry.reference || shortId(row.entry_id))}</strong></td>
                <td>${escapeHtml(post.admin_title ? `#${post.post_order} ${post.admin_title}` : shortId(row.official_post_id))}</td>
                <td>${escapeHtml(titleCase(row.activity_type))}</td>
                <td>${renderStatusChip(row.status, 'activity-status')}</td>
                <td>${escapeHtml(String(row.points_awarded ?? 0))}</td>
                <td>${escapeHtml(formatDateTime(row.participant_reported_at))}</td>
                <td>${escapeHtml(formatDateTime(row.verified_activity_at))}</td>
                <td>${escapeHtml(formatDateTime(row.created_at))}</td>
                <td><button class="btn-secondary btn-small" type="button" data-special-offers-activity-detail="${escapeHtml(row.id)}">Details / Review</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderActivityPagination() {
  const state = specialOffersState.manualVerification.activities;
  const totalPages = Math.max(1, Math.ceil(Number(state.total || 0) / state.pageSize));
  return `
    <div class="special-offer-entry-pagination">
      <button class="btn-secondary btn-small" type="button" data-special-offers-activity-page="prev" ${state.page <= 1 || state.loading ? 'disabled' : ''}>Previous</button>
      <span>Page ${escapeHtml(String(state.page))} of ${escapeHtml(String(totalPages))} · ${escapeHtml(String(state.total || 0))} total</span>
      <button class="btn-secondary btn-small" type="button" data-special-offers-activity-page="next" ${state.page >= totalPages || state.loading ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function renderManualVerificationBody() {
  return `
    ${renderManualVerificationNotice()}
    ${renderManualVerificationFilters()}
    ${renderManualActivityCounts()}
    ${renderOfficialPostsSection()}
    <section class="special-offers-detail-panel special-offers-detail-panel--wide">
      <div class="special-offer-entry-section-heading">
        <div>
          <h4>Activity queue</h4>
          <p class="special-offer-editor-muted">Share/comment claims are reviewed manually. Decisions go through review_special_offer_activity.</p>
        </div>
      </div>
      ${renderActivityQueue()}
      ${renderActivityPagination()}
    </section>
  `;
}

function renderManualWinnerNotice() {
  return `
    <div class="special-offer-manual-notice" role="note">
      <strong>The winner is selected manually by the administrator.</strong>
      <span>Points are a supporting criterion only. This panel does not run a draw, send messages or select a winner automatically.</span>
    </div>
  `;
}

function renderManualWinnerFilters() {
  const state = specialOffersState.manualWinner;
  return `
    <div class="special-offer-entry-filters">
      <label>
        Campaign
        <select data-special-offers-winner-offer>
          ${specialOffersState.campaigns.map((campaign) => `<option value="${escapeHtml(campaign.id)}"${String(state.offerId) === String(campaign.id) ? ' selected' : ''}>${escapeHtml(formatCampaignTitle(campaign))}</option>`).join('')}
        </select>
      </label>
      <button class="btn-secondary btn-small" type="button" data-special-offers-winner-refresh>Refresh</button>
    </div>
  `;
}

function renderReadinessBlockingReasons(readiness) {
  const reasons = getWinnerWorkflowBlockingReasons(readiness);
  if (!reasons.length) return '<p class="special-offer-editor-muted">No backend blocking reason reported.</p>';
  return `
    <ul class="special-offer-winner-reasons">
      ${reasons.map((reason) => `<li>${escapeHtml(titleCase(reason))}</li>`).join('')}
    </ul>
  `;
}

function renderManualWinnerReadiness() {
  const state = specialOffersState.manualWinner;
  const readiness = state.readiness;
  const campaign = getCampaignById(state.offerId);
  if (!readiness) {
    return '<div class="special-offer-entry-state">Readiness summary is not available yet.</div>';
  }
  const canStart = Boolean(readiness.can_start_workflow);
  const runningCampaign = readiness.campaign_ended === false;
  return `
    <section class="special-offers-detail-panel special-offers-detail-panel--wide">
      <div class="special-offer-entry-section-heading">
        <div>
          <h4>Workflow readiness</h4>
          <p class="special-offer-editor-muted">Final selection can start only after the campaign has ended and all pending reviews are resolved.</p>
        </div>
      </div>
      ${renderDetailRows([
        ['Campaign', campaign ? formatCampaignTitle(campaign) : shortId(state.offerId)],
        ['Campaign status', titleCase(readiness.campaign_status)],
        ['End at', formatDateTime(readiness.campaign_end_at)],
        ['Winner selection mode', titleCase(readiness.winner_selection_mode)],
        ['Campaign ended', readiness.campaign_ended ? 'Yes' : 'No'],
        ['Approved entries', readiness.approved_entries_count ?? 0],
        ['Pending entry reviews', readiness.pending_review_entries_count ?? 0],
        ['Pending activities', readiness.pending_activities_count ?? 0],
        ['Approved activities', readiness.approved_activities_count ?? 0],
        ['Active workflow', readiness.active_workflow_exists ? 'Yes' : 'No'],
        ['Can start workflow', canStart ? 'Yes' : 'No'],
      ])}
      ${!canStart ? `
        <div class="special-offer-entry-state">
          <strong>${runningCampaign ? 'Selection is disabled while the campaign is still running.' : 'Selection is currently blocked.'}</strong>
          ${renderReadinessBlockingReasons(readiness)}
        </div>
      ` : renderManualWinnerStartForm()}
    </section>
  `;
}

function renderManualWinnerStartForm() {
  const state = specialOffersState.manualWinner;
  const isOpen = state.action.type === 'start';
  if (!isOpen) {
    return `
      <button class="btn-primary btn-small" type="button" data-special-offers-winner-action="start">Start manual selection</button>
    `;
  }
  return `
    <form class="special-offer-entry-review-form" data-special-offers-winner-action-form="start">
      <h5>Start manual winner selection</h5>
      <p class="special-offer-editor-warning">This is not a draw. Points are a supporting criterion only and do not select the winner automatically.</p>
      ${state.action.error ? `<div class="special-offer-entry-state special-offer-entry-state--error">${escapeHtml(state.action.error)}</div>` : ''}
      <label>Reason *
        <textarea name="reason" rows="3" maxlength="2000" required placeholder="Internal reason for starting manual selection"></textarea>
      </label>
      <div class="special-offer-editor-actions">
        <button class="btn-primary btn-small" type="submit" ${state.action.submitting ? 'disabled' : ''}>Confirm start</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action-cancel>Cancel</button>
      </div>
    </form>
  `;
}

function formatParticipantDisplayName(entry) {
  return [entry?.first_name, entry?.last_name].filter(Boolean).join(' ').trim() || maskEmail(entry?.normalized_email);
}

function renderWinnerScoreCells(score) {
  return `
    <td>${escapeHtml(String(Number(score?.base_points || 0)))}</td>
    <td>${escapeHtml(String(Number(score?.share_points || 0)))}</td>
    <td>${escapeHtml(String(Number(score?.comment_points || 0)))}</td>
    <td>${escapeHtml(String(Number(score?.bonus_points || 0)))}</td>
    <td><strong>${escapeHtml(String(Number(score?.total_points || 0)))}</strong></td>
    <td>${escapeHtml(String(Number(score?.approved_activity_count || 0)))}</td>
  `;
}

function renderEligibleEntriesSection() {
  const state = specialOffersState.manualWinner;
  const workflow = state.activeWorkflow;
  const rows = toArray(state.eligibleEntries);
  return `
    <section class="special-offers-detail-panel special-offers-detail-panel--wide">
      <div class="special-offer-entry-section-heading">
        <div>
          <h4>Eligible entries</h4>
          <p class="special-offer-editor-muted">Only approved entries are shown. The default order is submission time, not points.</p>
        </div>
      </div>
      ${!workflow ? '<p class="special-offers-empty-copy">Start a workflow after readiness passes to add entries to the shortlist.</p>' : ''}
      ${rows.length ? `
        <div class="special-offer-entry-table-wrap">
          <table class="special-offer-entry-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Participant</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Base</th>
                <th>Share</th>
                <th>Comment</th>
                <th>Bonus</th>
                <th>Total</th>
                <th>Approved activities</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((entry) => {
                const score = state.scoresByEntryId[entry.id] || null;
                return `
                  <tr>
                    <td><strong>${escapeHtml(entry.reference || shortId(entry.id))}</strong></td>
                    <td>${escapeHtml(formatParticipantDisplayName(entry))}</td>
                    <td>${escapeHtml(formatDateTime(entry.created_at))}</td>
                    <td>${renderStatusChip(entry.status, 'entry-status')}</td>
                    ${renderWinnerScoreCells(score)}
                    <td>
                      <button class="btn-secondary btn-small" type="button" data-special-offers-entry-full-form="${escapeHtml(entry.id)}">View form</button>
                      <button class="btn-secondary btn-small" type="button" data-special-offers-winner-view-activities="${escapeHtml(entry.id)}">View activities</button>
                      <button class="btn-primary btn-small" type="button" data-special-offers-winner-add-shortlist="${escapeHtml(entry.id)}" ${workflow ? '' : 'disabled'}>Add to shortlist</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="special-offers-empty-copy">No approved entries are currently eligible for shortlist.</p>'}
    </section>
  `;
}

function getContactForShortlist(shortlistId) {
  return toArray(specialOffersState.manualWinner.contacts).find((row) => String(row.shortlist_id) === String(shortlistId)) || null;
}

function getActivePublicationForWorkflow(workflowId) {
  return toArray(specialOffersState.manualWinner.publications)
    .find((row) => String(row.workflow_id) === String(workflowId) && !row.unpublished_at) || null;
}

function hasDeclinedOrNoResponsePrimaryContact() {
  const state = specialOffersState.manualWinner;
  const primaryIds = new Set(toArray(state.shortlist)
    .filter((row) => row.status === 'active' && row.role === 'primary')
    .map((row) => String(row.id)));
  return toArray(state.contacts).some((contact) => (
    primaryIds.has(String(contact.shortlist_id))
    && ['declined', 'no_response'].includes(String(contact.status || ''))
  ));
}

function renderScoreSnapshot(snapshot) {
  const score = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return `
    <div class="special-offer-score-grid">
      ${[
        ['Base', score.base_points],
        ['Share', score.share_points],
        ['Comment', score.comment_points],
        ['Bonus', score.bonus_points],
        ['Total', score.total_points],
        ['Approved activities', score.approved_activity_count],
      ].map(([label, value]) => `
        <span class="special-offer-entry-count"><strong>${escapeHtml(String(Number(value || 0)))}</strong>${escapeHtml(label)}</span>
      `).join('')}
    </div>
    <p class="special-offer-editor-muted">Snapshot at: ${escapeHtml(formatDateTime(score.snapshot_at))}. Current score may differ.</p>
  `;
}

function renderWinnerInlineActionForm(type, targetId) {
  const state = specialOffersState.manualWinner;
  if (state.action.type !== type || String(state.action.targetId || '') !== String(targetId || '')) return '';
  const reasonPlaceholder = 'Internal reason for this manual decision';
  const hasError = state.action.error ? `<div class="special-offer-entry-state special-offer-entry-state--error">${escapeHtml(state.action.error)}</div>` : '';
  if (type === 'backup') {
    return `
      <form class="special-offer-entry-review-form" data-special-offers-winner-action-form="backup" data-winner-action-target="${escapeHtml(targetId)}">
        <h5>Set backup candidate</h5>
        ${hasError}
        <label>Backup rank *
          <input name="backup_rank" type="number" min="1" required />
        </label>
        <label>Reason *
          <textarea name="reason" rows="2" maxlength="2000" required placeholder="${escapeHtml(reasonPlaceholder)}"></textarea>
        </label>
        <div class="special-offer-editor-actions">
          <button class="btn-primary btn-small" type="submit" ${state.action.submitting ? 'disabled' : ''}>Confirm backup</button>
          <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action-cancel>Cancel</button>
        </div>
      </form>
    `;
  }
  if (type === 'contact') {
    return `
      <form class="special-offer-entry-review-form" data-special-offers-winner-action-form="contact" data-winner-action-target="${escapeHtml(targetId)}">
        <h5>Record manual contact start</h5>
        <p class="special-offer-editor-muted">Contact is handled outside the platform. The system does not send messages automatically. Record only the result of manual contact here.</p>
        ${hasError}
        <label>Response deadline *
          <input name="response_deadline_at" type="datetime-local" required />
        </label>
        <label>Private note
          <textarea name="note_text" rows="2" maxlength="2000" placeholder="Optional internal contact note"></textarea>
        </label>
        <div class="special-offer-editor-actions">
          <button class="btn-primary btn-small" type="submit" ${state.action.submitting ? 'disabled' : ''}>Save contact start</button>
          <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action-cancel>Cancel</button>
        </div>
      </form>
    `;
  }
  if (type === 'response') {
    return `
      <form class="special-offer-entry-review-form" data-special-offers-winner-action-form="response" data-winner-action-target="${escapeHtml(targetId)}">
        <h5>Record manual contact result</h5>
        <p class="special-offer-editor-muted">No message is sent. This only records the result of contact handled outside the platform.</p>
        ${hasError}
        <label>Status *
          <select name="response_status" required>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="no_response">No response</option>
          </select>
        </label>
        <label>Private note
          <textarea name="note_text" rows="2" maxlength="2000" placeholder="Optional internal contact note"></textarea>
        </label>
        <div class="special-offer-editor-actions">
          <button class="btn-primary btn-small" type="submit" ${state.action.submitting ? 'disabled' : ''}>Save contact result</button>
          <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action-cancel>Cancel</button>
        </div>
      </form>
    `;
  }
  if (type === 'publish') {
    return `
      <form class="special-offer-entry-review-form" data-special-offers-winner-action-form="publish" data-winner-action-target="${escapeHtml(targetId)}">
        <h5>Publish winner result</h5>
        <p class="special-offer-editor-warning">Public name must be typed manually and consent must be confirmed before publishing.</p>
        ${hasError}
        <label>Public name *
          <input name="public_name" type="text" maxlength="160" required autocomplete="off" />
        </label>
        <label class="special-offer-checkbox-row">
          <input name="publication_consent_confirmed" type="checkbox" required />
          Publication consent has been confirmed.
        </label>
        <label>Reason *
          <textarea name="reason" rows="2" maxlength="1000" required placeholder="${escapeHtml(reasonPlaceholder)}"></textarea>
        </label>
        <div class="special-offer-editor-actions">
          <button class="btn-primary btn-small" type="submit" ${state.action.submitting ? 'disabled' : ''}>Publish winner</button>
          <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action-cancel>Cancel</button>
        </div>
      </form>
    `;
  }
  return `
    <form class="special-offer-entry-review-form" data-special-offers-winner-action-form="${escapeHtml(type)}" data-winner-action-target="${escapeHtml(targetId)}">
      <h5>${escapeHtml(titleCase(type))}</h5>
      ${hasError}
      <label>Reason *
        <textarea name="reason" rows="2" maxlength="2000" required placeholder="${escapeHtml(reasonPlaceholder)}"></textarea>
      </label>
      <div class="special-offer-editor-actions">
        <button class="btn-primary btn-small" type="submit" ${state.action.submitting ? 'disabled' : ''}>Confirm</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action-cancel>Cancel</button>
      </div>
    </form>
  `;
}

function renderShortlistActions(item, contact) {
  const workflowStatus = String(specialOffersState.manualWinner.activeWorkflow?.status || '');
  const needsRecheck = item.status === 'needs_recheck';
  const isRemoved = item.status === 'removed';
  const terminalContact = ['accepted', 'declined', 'no_response', 'replaced'].includes(String(contact?.status || ''));
  if (isRemoved) return '<p class="special-offer-editor-muted">This shortlist item was removed.</p>';
  return `
    <div class="special-offer-entry-review-actions">
      <button class="btn-secondary btn-small" type="button" data-special-offers-entry-full-form="${escapeHtml(item.entry_id)}">View form</button>
      <button class="btn-secondary btn-small" type="button" data-special-offers-winner-view-activities="${escapeHtml(item.entry_id)}">View activities</button>
      ${needsRecheck ? `<button class="btn-primary btn-small" type="button" data-special-offers-winner-action="recheck" data-winner-action-target="${escapeHtml(item.id)}">Mark rechecked</button>` : ''}
      <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action="primary" data-winner-action-target="${escapeHtml(item.id)}" ${needsRecheck ? 'disabled title="Needs recheck before role assignment."' : ''}>Set primary</button>
      <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action="backup" data-winner-action-target="${escapeHtml(item.id)}" ${needsRecheck ? 'disabled title="Needs recheck before role assignment."' : ''}>Set backup</button>
      ${item.role === 'primary' && !contact ? `<button class="btn-secondary btn-small" type="button" data-special-offers-winner-action="contact" data-winner-action-target="${escapeHtml(item.id)}">Start manual contact</button>` : ''}
      ${contact && contact.status === 'contact_started' ? `<button class="btn-secondary btn-small" type="button" data-special-offers-winner-action="response" data-winner-action-target="${escapeHtml(contact.id)}">Record response</button>` : ''}
      ${item.role === 'backup' && hasDeclinedOrNoResponsePrimaryContact() ? `<button class="btn-secondary btn-small" type="button" data-special-offers-winner-action="promote" data-winner-action-target="${escapeHtml(item.id)}">Promote backup</button>` : ''}
      ${item.role === 'primary' && contact?.status === 'accepted' && !['winner_confirmed', 'published'].includes(workflowStatus) ? `<button class="btn-primary btn-small" type="button" data-special-offers-winner-action="confirm" data-winner-action-target="${escapeHtml(contact.id)}">Confirm winner</button>` : ''}
      ${terminalContact ? '' : `<button class="btn-danger btn-small" type="button" data-special-offers-winner-action="remove" data-winner-action-target="${escapeHtml(item.id)}">Remove from shortlist</button>`}
    </div>
  `;
}

function renderShortlistGroup(title, rows) {
  const state = specialOffersState.manualWinner;
  if (!rows.length) return '';
  return `
    <div class="special-offer-winner-group">
      <h5>${escapeHtml(title)}</h5>
      <div class="special-offer-entry-answers">
        ${rows.map((item) => {
          const entry = state.entriesById[item.entry_id] || {};
          const currentScore = state.scoresByEntryId[item.entry_id] || null;
          const contact = getContactForShortlist(item.id);
          return `
            <article class="special-offer-entry-answer special-offer-winner-shortlist-card">
              <div>
                <strong>${escapeHtml(entry.reference || shortId(item.entry_id))} · ${escapeHtml(formatParticipantDisplayName(entry))}</strong>
                <span>${escapeHtml(titleCase(item.status))} · ${escapeHtml(titleCase(item.role))}${item.backup_rank ? ` #${escapeHtml(item.backup_rank)}` : ''} · Added ${escapeHtml(formatDateTime(item.added_at))}</span>
              </div>
              ${item.status === 'needs_recheck' ? '<p class="special-offer-editor-warning">This entry was corrected after shortlist/candidate selection and needs recheck before role assignment.</p>' : ''}
              <div class="special-offers-detail-grid">
                <section class="special-offers-detail-panel">
                  <h5>Saved score snapshot</h5>
                  ${renderScoreSnapshot(item.score_snapshot_json)}
                </section>
                <section class="special-offers-detail-panel">
                  <h5>Current score</h5>
                  ${renderScoreSummary(currentScore)}
                </section>
                <section class="special-offers-detail-panel">
                  <h5>Contact</h5>
                  ${renderDetailRows([
                    ['Status', titleCase(contact?.status || 'not_started')],
                    ['Started at', formatDateTime(contact?.contact_started_at)],
                    ['Deadline', formatDateTime(contact?.response_deadline_at)],
                    ['Accepted at', formatDateTime(contact?.accepted_at)],
                    ['Declined at', formatDateTime(contact?.declined_at)],
                    ['No response at', formatDateTime(contact?.no_response_at)],
                  ])}
                  <p class="special-offer-editor-muted">Contact is handled outside the platform. The system does not send messages automatically.</p>
                </section>
              </div>
              ${renderShortlistActions(item, contact)}
              ${renderWinnerInlineActionForm('primary', item.id)}
              ${renderWinnerInlineActionForm('backup', item.id)}
              ${renderWinnerInlineActionForm('remove', item.id)}
              ${renderWinnerInlineActionForm('contact', item.id)}
              ${contact ? renderWinnerInlineActionForm('response', contact.id) : ''}
              ${renderWinnerInlineActionForm('promote', item.id)}
              ${contact ? renderWinnerInlineActionForm('confirm', contact.id) : ''}
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderShortlistSection() {
  const state = specialOffersState.manualWinner;
  const workflow = state.activeWorkflow;
  if (!workflow) {
    return `
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Shortlist</h4>
        <p class="special-offers-empty-copy">No active manual winner workflow exists yet.</p>
      </section>
    `;
  }
  const rows = toArray(state.shortlist);
  const activeRows = rows.filter((row) => row.status !== 'removed');
  const primary = activeRows.filter((row) => row.role === 'primary');
  const backups = activeRows.filter((row) => row.role === 'backup').sort((a, b) => Number(a.backup_rank || 0) - Number(b.backup_rank || 0));
  const needsRecheck = activeRows.filter((row) => row.status === 'needs_recheck');
  const rest = activeRows.filter((row) => row.role === 'shortlisted' && row.status !== 'needs_recheck');
  const removed = rows.filter((row) => row.status === 'removed');
  const publication = getActivePublicationForWorkflow(workflow.id);
  return `
    <section class="special-offers-detail-panel special-offers-detail-panel--wide">
      <div class="special-offer-entry-section-heading">
        <div>
          <h4>Shortlist</h4>
          <p class="special-offer-editor-muted">Roles are assigned manually. Score snapshots are historical support data only.</p>
        </div>
        ${renderStatusChip(workflow.status, 'winner-workflow')}
      </div>
      ${renderDetailRows([
        ['Workflow status', titleCase(workflow.status)],
        ['Started at', formatDateTime(workflow.started_at)],
        ['Confirmed entry', workflow.confirmed_entry_id ? shortId(workflow.confirmed_entry_id) : 'Not set'],
        ['Confirmed at', formatDateTime(workflow.confirmed_at)],
        ['Published at', formatDateTime(workflow.published_at)],
      ])}
      ${workflow.status === 'winner_confirmed' && !publication ? `
        <button class="btn-primary btn-small" type="button" data-special-offers-winner-action="publish" data-winner-action-target="${escapeHtml(workflow.id)}">Publish winner result</button>
        ${renderWinnerInlineActionForm('publish', workflow.id)}
      ` : ''}
      ${publication ? `
        <div class="special-offer-entry-state">
          <strong>Winner result is published as:</strong> ${escapeHtml(publication.public_name)}
          <button class="btn-secondary btn-small" type="button" data-special-offers-winner-action="unpublish" data-winner-action-target="${escapeHtml(publication.id)}">Unpublish</button>
          ${renderWinnerInlineActionForm('unpublish', publication.id)}
        </div>
      ` : ''}
      ${rows.length ? `
        ${renderShortlistGroup('Primary candidate', primary)}
        ${renderShortlistGroup('Backup candidates', backups)}
        ${renderShortlistGroup('Needs recheck', needsRecheck)}
        ${renderShortlistGroup('Shortlisted entries', rest)}
        ${renderShortlistGroup('Removed history', removed)}
      ` : '<p class="special-offers-empty-copy">No entries have been added to the shortlist yet.</p>'}
    </section>
  `;
}

function renderWinnerEntryActivities(entryId) {
  const rows = toArray(specialOffersState.manualWinner.activitiesByEntryId?.[entryId]);
  if (!rows.length) return '<p class="special-offers-empty-copy">No verified or pending activities are linked to this entry.</p>';
  return `
    <div class="special-offer-entry-answers">
      ${rows.map((activity) => `
        <article class="special-offer-entry-answer">
          <div>
            <strong>${escapeHtml(titleCase(activity.activity_type))}</strong>
            <span>${escapeHtml(titleCase(activity.status))} · ${escapeHtml(String(activity.points_awarded || 0))} point</span>
          </div>
          <p>Created: ${escapeHtml(formatDateTime(activity.created_at))} · Verified: ${escapeHtml(formatDateTime(activity.verified_at))}</p>
          <button class="btn-secondary btn-small" type="button" data-special-offers-activity-detail="${escapeHtml(activity.id)}">Open activity detail</button>
        </article>
      `).join('')}
    </div>
  `;
}

function renderWinnerAuditTrail() {
  const rows = toArray(specialOffersState.manualWinner.auditLog);
  if (!rows.length) return '<p class="special-offers-empty-copy">No winner workflow audit entries yet.</p>';
  return `
    <section class="special-offers-detail-panel special-offers-detail-panel--wide">
      <h4>Winner workflow audit</h4>
      <div class="special-offer-entry-audit">
        ${rows.map((row) => {
          const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
          const oldStatus = row?.old_value?.status || row?.old_value?.old_status || metadata.old_status || '—';
          const newStatus = row?.new_value?.status || row?.new_value?.new_status || metadata.new_status || '—';
          return `
            <article class="special-offer-entry-audit-row">
              <strong>${escapeHtml(titleCase(row.action || 'audit'))}</strong>
              <span>${escapeHtml(formatDateTime(row.created_at))}</span>
              <span>${escapeHtml(titleCase(oldStatus))} → ${escapeHtml(titleCase(newStatus))}</span>
              <span>Role: ${escapeHtml(titleCase(metadata.role || row?.new_value?.role || '—'))}</span>
              <span>Backup rank: ${escapeHtml(metadata.backup_rank ?? row?.new_value?.backup_rank ?? '—')}</span>
              <span>Reason present: ${metadata.reason_present ? 'yes' : 'no'}</span>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderManualWinnerBody() {
  const state = specialOffersState.manualWinner;
  if (state.loading) return '<div class="special-offer-entry-state">Loading manual winner selection...</div>';
  if (state.error) {
    return `
      ${renderManualWinnerFilters()}
      ${renderManualWinnerLoadError()}
      <button class="btn-secondary btn-small" type="button" data-special-offers-winner-refresh>Retry</button>
    `;
  }
  return `
    ${renderManualWinnerNotice()}
    ${renderManualWinnerFilters()}
    ${renderManualWinnerReadiness()}
    ${renderEligibleEntriesSection()}
    ${renderShortlistSection()}
    ${renderWinnerAuditTrail()}
  `;
}

function getFieldSnapshot(answer) {
  return answer?.field_snapshot_json && typeof answer.field_snapshot_json === 'object' ? answer.field_snapshot_json : {};
}

function getAnswerSortOrder(answer) {
  const snapshot = getFieldSnapshot(answer);
  const value = Number(snapshot.sort_order);
  return Number.isFinite(value) ? value : 9999;
}

function formatAnswerValue(answer) {
  const snapshot = getFieldSnapshot(answer);
  const type = String(snapshot.field_type || '').toLowerCase();
  const value = answer?.value_json ?? answer?.value_text ?? null;
  if (value === null || value === undefined || value === '') return '<span class="special-offer-editor-muted">Not answered</span>';
  if (type === 'checkbox' || type === 'consent' || typeof value === 'boolean') {
    return escapeHtml(value ? 'Yes' : 'No');
  }
  if (Array.isArray(value)) {
    return value.map((item) => escapeHtml(String(item))).join(', ');
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (['url', 'facebook_profile_url', 'shared_post_url'].includes(type) && isSafeHttpUrl(text)) {
    return `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  }
  return escapeHtml(text);
}

function renderEntryAnswers(answers) {
  const rows = toArray(answers).slice().sort((a, b) => getAnswerSortOrder(a) - getAnswerSortOrder(b));
  if (!rows.length) return '<p class="special-offers-empty-copy">No answer rows are stored for this entry.</p>';
  return `
    <div class="special-offer-entry-answers">
      ${rows.map((answer) => {
        const snapshot = getFieldSnapshot(answer);
        const label = snapshot.label || titleCase(answer.field_key);
        const type = snapshot.field_type || 'field';
        return `
          <article class="special-offer-entry-answer">
            <div>
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(answer.field_key)} · ${escapeHtml(type)}</span>
            </div>
            <p>${formatAnswerValue(answer)}</p>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderEntryFullForm(detail) {
  const entry = detail?.entry || {};
  const answers = toArray(detail?.answers).slice().sort((a, b) => getAnswerSortOrder(a) - getAnswerSortOrder(b));
  if (!answers.length) return '<p class="special-offers-empty-copy">No stored form fields are available for this entry.</p>';
  const submittedLang = String(entry.submitted_lang || '').toUpperCase() || '—';
  return `
    <div class="special-offer-entry-full-form" dir="${entry.submitted_lang === 'he' ? 'rtl' : 'ltr'}">
      <div class="special-offer-entry-full-form__meta">
        ${renderDetailRows([
          ['Reference', entry.reference],
          ['Status', titleCase(entry.status)],
          ['Submitted language', submittedLang],
          ['Submitted at', formatDateTime(entry.created_at)],
        ])}
      </div>
      <div class="special-offer-entry-answers special-offer-entry-answers--full">
        ${answers.map((answer) => {
          const snapshot = getFieldSnapshot(answer);
          const label = snapshot.label || titleCase(answer.field_key);
          const help = snapshot.help_text || '';
          const required = snapshot.required === true;
          return `
            <article class="special-offer-entry-answer special-offer-entry-answer--full">
              <div>
                <strong>${escapeHtml(label)}${required ? ' *' : ''}</strong>
                <span>${escapeHtml(answer.field_key)} · ${escapeHtml(snapshot.field_type || 'field')}</span>
              </div>
              <p>${formatAnswerValue(answer)}</p>
              ${help ? `<small>${escapeHtml(help)}</small>` : ''}
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function ensureEntryFullFormModal() {
  let modal = $('#specialOfferEntryFullFormModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-entry-detail-modal';
  modal.id = 'specialOfferEntryFullFormModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-entry-full-form-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOfferEntryFullFormTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Read-only form</div>
          <h3 id="specialOfferEntryFullFormTitle">Full submitted form</h3>
          <p class="special-offer-editor-subtitle">Snapshot labels and answers from submission time. Answers cannot be edited here.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-entry-full-form-close aria-label="Close full form">×</button>
      </header>
      <div class="admin-modal-body" id="specialOfferEntryFullFormBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-entry-full-form-close]')) {
      closeEntryFullForm();
    }
  });
  return modal;
}

function closeEntryFullForm() {
  const modal = $('#specialOfferEntryFullFormModal');
  if (modal) modal.hidden = true;
}

async function openEntryFullForm(entryId = '') {
  const modal = ensureEntryFullFormModal();
  const body = $('#specialOfferEntryFullFormBody', modal);
  modal.hidden = false;
  if (body) body.innerHTML = '<div class="special-offer-entry-state">Loading full form...</div>';
  try {
    const detail = specialOffersState.entries.detail?.entry?.id === entryId
      ? specialOffersState.entries.detail
      : await loadEntryDetail(entryId);
    if (body) body.innerHTML = renderEntryFullForm(detail);
  } catch (_error) {
    if (body) body.innerHTML = '<div class="special-offer-entry-state special-offer-entry-state--error">Unable to load full submitted form.</div>';
  }
}

function renderEntryAuditLog(rows) {
  if (!toArray(rows).length) return '<p class="special-offers-empty-copy">No review audit entries yet.</p>';
  return `
    <div class="special-offer-entry-audit">
      ${toArray(rows).map((row) => {
        const oldStatus = row?.old_value?.status || row?.old_value?.previous_status || '—';
        const newStatus = row?.new_value?.status || row?.new_value?.new_status || '—';
        const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        return `
          <article class="special-offer-entry-audit-row">
            <strong>${escapeHtml(row.action || 'audit')}</strong>
            <span>${escapeHtml(formatDateTime(row.created_at))}</span>
            <span>${escapeHtml(titleCase(oldStatus))} → ${escapeHtml(titleCase(newStatus))}</span>
            <span>Actor: ${escapeHtml(shortId(row.actor_id))}</span>
            <span>Note: ${metadata.review_note_present ? 'yes' : 'no'} · Reason: ${metadata.rejection_reason_present ? 'yes' : 'no'}</span>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderScoreSummary(score) {
  if (!score) return '<p class="special-offers-empty-copy">Score summary is not available yet.</p>';
  const items = [
    ['Base points', score.base_points],
    ['Share points', score.share_points],
    ['Comment points', score.comment_points],
    ['Bonus points', score.bonus_points],
    ['Total points', score.total_points],
    ['Approved activities', score.approved_activity_count],
  ];
  return `
    <div class="special-offer-score-grid">
      ${items.map(([label, value]) => `
        <span class="special-offer-entry-count">
          <strong>${escapeHtml(String(Number(value || 0)))}</strong>
          ${escapeHtml(label)}
        </span>
      `).join('')}
    </div>
    <p class="special-offer-editor-muted">Points are a supporting criterion. The winner is selected manually by the administrator.</p>
  `;
}

function renderEntryWinnerSelection(detail) {
  const winner = detail?.winnerSelection || {};
  const shortlist = toArray(winner.shortlist);
  const contacts = toArray(winner.contacts);
  const publications = toArray(winner.publications);
  const workflows = toArray(winner.workflows);
  if (!shortlist.length && !contacts.length && !publications.length) {
    return '<p class="special-offers-empty-copy">This entry is not linked to a manual winner workflow.</p>';
  }
  const latestShortlist = shortlist[0] || {};
  const workflow = workflows.find((row) => String(row.id) === String(latestShortlist.workflow_id)) || workflows[0] || {};
  const latestContact = contacts[0] || {};
  const latestPublication = publications[0] || {};
  return `
    ${renderDetailRows([
      ['Workflow status', titleCase(workflow.status || 'not linked')],
      ['Shortlist status', titleCase(latestShortlist.status || 'not shortlisted')],
      ['Role', titleCase(latestShortlist.role || 'not set')],
      ['Backup rank', latestShortlist.backup_rank ?? 'Not set'],
      ['Needs recheck', latestShortlist.status === 'needs_recheck' ? 'Yes' : 'No'],
      ['Entry status snapshot', titleCase(latestShortlist.entry_status_snapshot || 'not set')],
      ['Contact status', titleCase(latestContact.status || 'not_started')],
      ['Confirmed winner', workflow.confirmed_entry_id === detail?.entry?.id ? 'Yes' : 'No'],
      ['Publication status', latestPublication.id && !latestPublication.unpublished_at ? 'Published' : latestPublication.unpublished_at ? 'Unpublished' : 'Not published'],
    ])}
    ${latestShortlist.score_snapshot_json ? `
      <h5>Saved score snapshot</h5>
      ${renderScoreSnapshot(latestShortlist.score_snapshot_json)}
    ` : ''}
  `;
}

function renderEntryActivities(detail) {
  const rows = toArray(detail?.activities);
  if (!rows.length) return '<p class="special-offers-empty-copy">No activity claims are linked to this entry yet.</p>';
  const postsById = detail?.activityPostsById || {};
  return `
    <div class="special-offer-entry-answers">
      ${rows.map((activity) => {
        const post = postsById[activity.official_post_id] || {};
        return `
          <article class="special-offer-entry-answer">
            <div>
              <strong>${escapeHtml(titleCase(activity.activity_type))} · ${escapeHtml(post.admin_title || shortId(activity.official_post_id))}</strong>
              <span>${escapeHtml(titleCase(activity.status))} · ${escapeHtml(String(activity.points_awarded || 0))} point</span>
            </div>
            <p>${renderSafeExternalLink(activity.evidence_url)}</p>
            <button class="btn-secondary btn-small" type="button" data-special-offers-activity-detail="${escapeHtml(activity.id)}">Open activity detail</button>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderEntryDeletePanel(entry, detail = {}) {
  const answersCount = toArray(detail.answers).length;
  const activitiesCount = toArray(detail.activities).length;
  if (!specialOffersState.entries.deleteOpen) {
    return `
      <p class="special-offer-editor-warning">Permanent delete removes the entry, answers, related activity claims, evidence and entry points. It does not delete the user account, profile, campaign or official posts.</p>
      <button class="btn-danger btn-small" type="button" data-special-offers-entry-delete-open>Delete entry permanently</button>
    `;
  }
  return `
    <form class="special-offer-entry-delete-form" data-special-offers-entry-delete-form>
      <p class="special-offer-editor-warning">This operation is irreversible. It will delete ${escapeHtml(String(answersCount))} answer rows and ${escapeHtml(String(activitiesCount))} activity rows linked to this entry.</p>
      <label>Reason *
        <textarea name="delete_reason" rows="3" maxlength="1000" required placeholder="Internal reason for permanent deletion"></textarea>
      </label>
      <label>Type the exact reference to confirm *
        <input name="expected_reference" required autocomplete="off" placeholder="${escapeHtml(entry.reference || '')}" />
      </label>
      <div class="special-offer-editor-actions">
        <button class="btn-danger btn-small" type="submit" ${specialOffersState.entries.deleting ? 'disabled' : ''}>Delete permanently</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-entry-delete-cancel ${specialOffersState.entries.deleting ? 'disabled' : ''}>Cancel</button>
      </div>
    </form>
  `;
}

function renderActivityAuditLog(rows) {
  if (!toArray(rows).length) return '<p class="special-offers-empty-copy">No activity audit entries yet.</p>';
  return `
    <div class="special-offer-entry-audit">
      ${toArray(rows).map((row) => {
        const oldStatus = row?.old_value?.status || row?.old_value?.old_status || '—';
        const newStatus = row?.new_value?.status || row?.new_value?.new_status || '—';
        const oldPoints = row?.old_value?.points_awarded ?? row?.old_value?.old_points ?? '—';
        const newPoints = row?.new_value?.points_awarded ?? row?.new_value?.new_points ?? '—';
        const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        return `
          <article class="special-offer-entry-audit-row">
            <strong>${escapeHtml(row.action || 'audit')}</strong>
            <span>${escapeHtml(formatDateTime(row.created_at))}</span>
            <span>${escapeHtml(titleCase(oldStatus))} → ${escapeHtml(titleCase(newStatus))}</span>
            <span>Points: ${escapeHtml(oldPoints)} → ${escapeHtml(newPoints)}</span>
            <span>Actor: ${escapeHtml(shortId(row.actor_id))}</span>
            <span>Note: ${metadata.review_note_present ? 'yes' : 'no'} · Reason: ${metadata.rejection_reason_present ? 'yes' : 'no'}</span>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderActivityReviewActions(activity) {
  const transitions = getActivityReviewTransitions(activity?.status);
  if (!transitions.length) {
    return '<p class="special-offer-editor-muted">No activity review actions are available for this status.</p>';
  }
  return `
    <div class="special-offer-entry-review-actions">
      ${transitions.map((status) => `<button class="btn-secondary btn-small" type="button" data-special-offers-activity-review-action="${escapeHtml(status)}">${escapeHtml(getActivityReviewActionLabel(status))}</button>`).join('')}
    </div>
  `;
}

function renderActivityReviewForm(action, detail) {
  if (!action) return '';
  const activity = detail?.activity || {};
  const post = detail?.post || {};
  const isCommentApproval = activity.activity_type === 'comment' && action === 'approved';
  const requiresReason = ['rejected', 'invalid'].includes(action);
  return `
    <form class="special-offer-entry-review-form" data-special-offers-activity-review-form>
      <h5>${escapeHtml(getActivityReviewActionLabel(action))}</h5>
      ${isCommentApproval ? `
        <div class="special-offer-manual-notice">
          <strong>Comment timing check</strong>
          <span>Published: ${escapeHtml(formatDateTime(post.published_at))} · Deadline: ${escapeHtml(formatDateTime(post.comment_deadline_at))} · Participant reported: ${escapeHtml(formatDateTime(activity.participant_reported_at))}</span>
        </div>
        <label>
          Verified comment time *
          <input name="verified_activity_at" type="datetime-local" required value="${escapeHtml(toLocalDateTimeInputValue(activity.verified_activity_at || activity.participant_reported_at))}" data-special-offers-activity-verified-at />
          <small>Admin-confirmed time must be between post publication and the 24h deadline.</small>
        </label>
      ` : `
        <label>
          Verified activity time <span class="special-offer-editor-muted">(optional for shares)</span>
          <input name="verified_activity_at" type="datetime-local" value="${escapeHtml(toLocalDateTimeInputValue(activity.verified_activity_at))}" data-special-offers-activity-verified-at />
        </label>
      `}
      <label>
        Review note <span class="special-offer-editor-muted">(optional)</span>
        <textarea name="review_note" rows="3" maxlength="2000" data-special-offers-activity-review-note></textarea>
        <small><span data-special-offers-activity-review-note-count>0</span>/2000</small>
      </label>
      <label>
        Rejection/invalid reason ${requiresReason ? '*' : '<span class="special-offer-editor-muted">(not required)</span>'}
        <textarea name="rejection_reason" rows="3" maxlength="1000" data-special-offers-activity-review-reason></textarea>
        <small><span data-special-offers-activity-review-reason-count>0</span>/1000</small>
      </label>
      <div class="special-offer-entry-review-footer">
        <button class="btn-primary btn-small" type="submit" data-special-offers-activity-review-submit="${escapeHtml(action)}" ${specialOffersState.manualVerification.activities.reviewing ? 'disabled' : ''}>Confirm ${escapeHtml(getActivityReviewActionLabel(action))}</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-activity-review-cancel>Cancel</button>
      </div>
      <p class="special-offer-editor-muted">This calls review_special_offer_activity. It does not modify entries, answers or snapshots.</p>
    </form>
  `;
}

function renderReviewActions(entry) {
  const transitions = getEntryStatusTransitions(entry?.status);
  if (!transitions.length) {
    return '<p class="special-offer-editor-muted">No review actions are available for this status.</p>';
  }
  return `
    <div class="special-offer-entry-review-actions">
      ${transitions.map((status) => `<button class="btn-secondary btn-small" type="button" data-special-offers-review-action="${escapeHtml(status)}">${escapeHtml(getReviewActionLabel(status))}</button>`).join('')}
    </div>
    <div id="specialOfferEntryReviewForm"></div>
  `;
}

function renderReviewForm(action) {
  if (!action) return '';
  const requiresReason = ['rejected', 'disqualified'].includes(action);
  return `
    <form class="special-offer-entry-review-form" data-special-offers-review-form>
      <h5>${escapeHtml(getReviewActionLabel(action))}</h5>
      <label>
        Review note <span class="special-offer-editor-muted">(optional)</span>
        <textarea name="review_note" rows="3" maxlength="2000" data-special-offers-review-note></textarea>
        <small><span data-special-offers-review-note-count>0</span>/2000</small>
      </label>
      <label>
        Rejection/disqualification reason ${requiresReason ? '*' : '<span class="special-offer-editor-muted">(not required)</span>'}
        <textarea name="rejection_reason" rows="3" maxlength="1000" data-special-offers-review-reason></textarea>
        <small><span data-special-offers-review-reason-count>0</span>/1000</small>
      </label>
      <div class="special-offer-entry-review-footer">
        <button class="btn-primary btn-small" type="submit" data-special-offers-review-submit="${escapeHtml(action)}" ${specialOffersState.entries.reviewing ? 'disabled' : ''}>Confirm ${escapeHtml(getReviewActionLabel(action))}</button>
        <button class="btn-secondary btn-small" type="button" data-special-offers-review-cancel>Cancel</button>
      </div>
      <p class="special-offer-editor-muted">This calls review_special_offer_entry. It does not modify answers or snapshots.</p>
    </form>
  `;
}

function normalizeCampaigns(offers, translationsByOffer, prizesByOffer, linksByOffer, prizeTranslationsByPrize = {}, linkTranslationsByLink = {}, formFieldsByOffer = {}, formFieldTranslationsByField = {}) {
  return toArray(offers).map((offer) => ({
    ...offer,
    translations: toArray(translationsByOffer[offer.id]),
    prizes: toArray(prizesByOffer[offer.id])
      .map((prize) => ({
        ...prize,
        translations: toArray(prizeTranslationsByPrize[prize.id]),
      }))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    links: toArray(linksByOffer[offer.id])
      .map((link) => ({
        ...link,
        mode: inferLinkMode(link),
        translations: toArray(linkTranslationsByLink[link.id]),
      }))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    form_fields: toArray(formFieldsByOffer[offer.id])
      .map((field) => ({
        ...field,
        validation_json: cloneJson(field.validation_json, {}),
        translations: toArray(formFieldTranslationsByField[field.id]),
      }))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
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

  const [translationsResult, prizesResult, linksResult, formFieldsResult, auditResult] = await Promise.all([
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
      .from('special_offer_form_fields')
      .select(SPECIAL_OFFERS_FORM_FIELDS_SELECT)
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
  if (formFieldsResult.error) throw formFieldsResult.error;
  if (auditResult.error) throw auditResult.error;

  const prizeIds = toArray(prizesResult.data).map((prize) => prize.id).filter(Boolean);
  const linkIds = toArray(linksResult.data).map((link) => link.id).filter(Boolean);
  const formFieldIds = toArray(formFieldsResult.data).map((field) => field.id).filter(Boolean);
  const [prizeTranslationsResult, linkTranslationsResult, formFieldTranslationsResult] = await Promise.all([
    prizeIds.length
      ? client
        .from('special_offer_prize_translations')
        .select(SPECIAL_OFFERS_PRIZE_TRANSLATIONS_SELECT)
        .in('prize_id', prizeIds)
      : Promise.resolve({ data: [], error: null }),
    linkIds.length
      ? client
        .from('special_offer_link_translations')
        .select(SPECIAL_OFFERS_LINK_TRANSLATIONS_SELECT)
        .in('link_id', linkIds)
      : Promise.resolve({ data: [], error: null }),
    formFieldIds.length
      ? client
        .from('special_offer_form_field_translations')
        .select(SPECIAL_OFFERS_FORM_FIELD_TRANSLATIONS_SELECT)
        .in('field_id', formFieldIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (prizeTranslationsResult.error) throw prizeTranslationsResult.error;
  if (linkTranslationsResult.error) throw linkTranslationsResult.error;
  if (formFieldTranslationsResult.error) throw formFieldTranslationsResult.error;

  const campaigns = normalizeCampaigns(
    offers,
    groupByOfferId(translationsResult.data),
    groupByOfferId(prizesResult.data),
    groupByOfferId(linksResult.data),
    groupByParentId(prizeTranslationsResult.data, 'prize_id'),
    groupByParentId(linkTranslationsResult.data, 'link_id'),
    groupByOfferId(formFieldsResult.data),
    groupByParentId(formFieldTranslationsResult.data, 'field_id'),
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
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.getSeconds() ? `${base}:${pad(date.getSeconds())}` : base;
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

function isCampaignEditableInAdmin(campaign) {
  if (!campaign) return true;
  return !['locked', 'archived'].includes(String(campaign.status || '').toLowerCase());
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
    form_fields_count: toArray(campaign.form_fields).length,
  };
}

function getCurrentCampaign() {
  return specialOffersState.campaigns.find((item) => item.id === specialOffersState.editingCampaignId) || null;
}

function getTempId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalizedTitle(value, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.pl || value.en || value.he || fallback;
  return fallback;
}

function getCarResourceLabel(row) {
  const name = readLocalizedTitle(row?.car_model, readLocalizedTitle(row?.car_type, 'Car offer'));
  const location = row?.location ? ` · ${row.location}` : '';
  const status = row?.is_available === false ? 'unavailable' : 'active';
  const price = Number(row?.price_per_day || row?.price_10plus_days || row?.price_7_10days || row?.price_4_6days || 0);
  return `${name}${location}${price ? ` · €${price}/day` : ''} · ${status}`;
}

function getTripResourceLabel(row) {
  const title = readLocalizedTitle(row?.title, row?.name || row?.slug || 'Trip');
  const city = row?.start_city || row?.location || '';
  const status = row?.status || (row?.is_published === false ? 'draft' : 'published');
  return `${title}${city ? ` · ${city}` : ''} · ${status}`;
}

function getHotelResourceLabel(row) {
  const title = readLocalizedTitle(row?.title, row?.name || row?.slug || 'Hotel');
  const city = row?.city || row?.location || '';
  const status = row?.status || (row?.is_published === false ? 'draft' : 'published');
  return `${title}${city ? ` · ${city}` : ''} · ${status}`;
}

function getTransportRouteLabel(row, locationById = {}) {
  const origin = locationById[String(row?.origin_location_id || '')]?.name || row?.origin_name || row?.origin || 'Origin';
  const destination = locationById[String(row?.destination_location_id || '')]?.name || row?.destination_name || row?.destination || 'Destination';
  const status = row?.is_active === false ? 'inactive' : 'active';
  return `${origin} -> ${destination} · ${status}`;
}

function buildResourceOptions(rows, type, locationById = {}) {
  return toArray(rows).map((row) => {
    const id = String(row?.id || '').trim();
    let label = id || 'Resource';
    let disabled = !id;
    let reason = '';
    if (type === 'cars') {
      label = getCarResourceLabel(row);
    } else if (type === 'trips') {
      label = getTripResourceLabel(row);
      disabled = disabled || !String(row?.slug || '').trim();
      reason = !String(row?.slug || '').trim() ? 'Missing slug' : '';
    } else if (type === 'hotels') {
      label = getHotelResourceLabel(row);
      disabled = disabled || !String(row?.slug || '').trim();
      reason = !String(row?.slug || '').trim() ? 'Missing slug' : '';
    } else if (type === 'transport') {
      label = getTransportRouteLabel(row, locationById);
    }
    return { ...row, id, label, disabled, reason };
  }).filter((row) => row.id);
}

async function loadResourcePickerOptions() {
  if (specialOffersState.resourceOptionsLoaded) return;
  const client = getSupabaseClient();
  if (!client) return;

  const nextOptions = { cars: [], trips: [], hotels: [], transport: [] };
  const nextErrors = {};

  const loadConfiguredPicker = async (type, buildRows) => {
    const config = SPECIAL_OFFERS_PICKER_CONFIG[type];
    if (!config?.supportsExistingResource) return;
    try {
      const result = await client.from(config.table).select(config.select).limit(100);
      if (result.error) throw result.error;
      nextOptions[type] = buildRows(result.data);
    } catch (error) {
      console.warn(`Special Offers ${type} picker failed:`, error);
      nextOptions[type] = [];
      nextErrors[type] = config.friendlyError;
    }
  };

  await Promise.all([
    loadConfiguredPicker('cars', (rows) => buildResourceOptions(rows, 'cars')),
    loadConfiguredPicker('trips', (rows) => buildResourceOptions(rows, 'trips')),
    loadConfiguredPicker('hotels', (rows) => buildResourceOptions(rows, 'hotels')),
    (async () => {
      try {
        const [routesResult, locationsResult] = await Promise.all([
          client.from(SPECIAL_OFFERS_PICKER_CONFIG.transport.table).select(SPECIAL_OFFERS_PICKER_CONFIG.transport.select).limit(100),
          client.from('transport_locations').select('id, name, code, is_active').limit(500),
        ]);
        if (routesResult.error) throw routesResult.error;
        if (locationsResult.error) throw locationsResult.error;
        const locationById = toArray(locationsResult.data).reduce((acc, row) => {
          if (row?.id) acc[String(row.id)] = row;
          return acc;
        }, {});
        nextOptions.transport = buildResourceOptions(routesResult.data, 'transport', locationById);
      } catch (error) {
        console.warn('Special Offers transport picker failed:', error);
        nextOptions.transport = [];
        nextErrors.transport = SPECIAL_OFFERS_PICKER_CONFIG.transport.friendlyError;
      }
    })(),
  ]);

  specialOffersState.resourceOptions = nextOptions;
  specialOffersState.resourceOptionsErrors = nextErrors;
  specialOffersState.resourceOptionsLoaded = true;
}

function getResourceOption(type, resourceId) {
  return toArray(specialOffersState.resourceOptions[type]).find((item) => String(item.id) === String(resourceId)) || null;
}

function buildResourceUrl(type, resourceId, lang) {
  const option = getResourceOption(type, resourceId);
  if (!option || option.disabled) return '';
  if (type === 'cars') return `/car.html?offer_id=${encodeURIComponent(option.id)}&lang=${lang}`;
  if (type === 'trips' && option.slug) return `/trip.html?slug=${encodeURIComponent(option.slug)}&lang=${lang}`;
  if (type === 'hotels' && option.slug) return `/hotel.html?slug=${encodeURIComponent(option.slug)}&lang=${lang}`;
  if (type === 'transport') return `/transport.html?route_id=${encodeURIComponent(option.id)}&lang=${lang}`;
  return '';
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
    saveButton.textContent = isSaving ? 'Saving...' : 'Save campaign';
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
  return prizes.map((prize, prizeIndex) => `
    <article class="special-offers-linked-service">
      <div class="special-offer-campaign-card__chips">
        <span class="special-offer-pill">Prize ${prizeIndex + 1}</span>
        <span class="special-offer-pill">Operational details</span>
      </div>
      ${renderDetailRows([
        ['Fallback name', prize.name],
        ['Sponsor', prize.sponsor_name],
        ['Quantity', prize.quantity],
        ['Value estimate', prize.value_estimate ? `${prize.value_estimate} ${prize.currency || 'EUR'}` : 'Not set'],
        ['Sort order', prize.sort_order],
      ])}
      ${renderPrizeTranslationTabs(prize, `detail-prize-${prizeIndex}`)}
    </article>
  `).join('');
}

function renderLinkedServices(links) {
  if (!links.length) return '<p class="special-offers-empty-copy">No linked services configured.</p>';
  return `
    <div class="special-offers-linked-service-list">
      ${links.map((link, linkIndex) => `
        <div class="special-offers-linked-service">
          <div class="special-offer-campaign-card__chips">
            <span class="special-offer-link-chip">${escapeHtml(titleCase(link.link_type))}</span>
            <span class="special-offer-pill">${escapeHtml(titleCase(link.mode || inferLinkMode(link)))}</span>
            <span class="special-offer-pill">${link.resource_id ? 'Resource ID' : 'No resource ID'}</span>
            ${link.is_primary ? '<span class="special-offer-pill">Primary CTA</span>' : ''}
          </div>
          ${renderDetailRows([
            ['Fallback label', link.label],
            ['Fallback URL', link.url],
            ['Resource ID', link.resource_id || 'None'],
            ['Fallback description', link.description],
          ])}
          ${renderLinkTranslationTabs(link, `detail-link-${linkIndex}`)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderLocalizedTabs(rows, prefix, emptyText, fields) {
  return `
    <div class="special-offers-translation-tabs special-offers-translation-tabs--compact" role="tablist" aria-label="${escapeHtml(prefix)} translations">
      ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => `
        <button
          class="special-offers-translation-tab${index === 0 ? ' is-active' : ''}"
          type="button"
          data-special-offers-local-tab="${escapeHtml(prefix)}:${escapeHtml(language.code)}"
          aria-selected="${index === 0 ? 'true' : 'false'}"
        >${escapeHtml(language.label)}</button>
      `).join('')}
    </div>
    <div class="special-offers-translation-panels">
      ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => {
        const row = getLocalizedRow(rows, language.code);
        return `
          <section
            class="special-offers-translation-panel"
            data-special-offers-local-panel="${escapeHtml(prefix)}:${escapeHtml(language.code)}"
            dir="${escapeHtml(language.dir)}"
            ${index === 0 ? '' : 'hidden'}
          >
            ${row ? renderDetailRows(fields.map(([label, key]) => [label, row[key]])) : `<p class="special-offers-empty-copy">${escapeHtml(emptyText)}</p>`}
          </section>
        `;
      }).join('')}
    </div>
  `;
}

function renderPrizeTranslationTabs(prize, prefix) {
  return renderLocalizedTabs(prize.translations, prefix, 'Prize translation not available yet', [
    ['Name', 'name'],
    ['Description', 'description'],
    ['Restrictions', 'restrictions'],
    ['Fulfillment notes', 'fulfillment_notes'],
  ]);
}

function renderLinkTranslationTabs(link, prefix) {
  return renderLocalizedTabs(link.translations, prefix, 'Link translation not available yet', [
    ['Label', 'label'],
    ['Description', 'description'],
    ['URL', 'url'],
  ]);
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

function renderHelp(key) {
  const item = SPECIAL_OFFERS_HELP[key];
  const label = item?.title || 'Help';
  return `<button class="special-offer-help" type="button" data-special-offers-help="${escapeHtml(key)}" aria-label="${escapeHtml(label)} help">?</button>`;
}

function ensureHelpPopover() {
  let node = $('#specialOffersHelpPopover');
  if (node) return node;
  node = document.createElement('div');
  node.className = 'special-offer-help-popover';
  node.id = 'specialOffersHelpPopover';
  node.hidden = true;
  node.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-help-close></div>
    <div class="special-offer-help-popover__content" role="dialog" aria-modal="true" aria-labelledby="specialOffersHelpTitle">
      <div class="special-offer-editor-item__header">
        <h3 id="specialOffersHelpTitle">Help</h3>
        <button class="btn-modal-close" type="button" data-special-offers-help-close aria-label="Close help">×</button>
      </div>
      <div id="specialOffersHelpBody"></div>
    </div>
  `;
  document.body.appendChild(node);
  node.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-help-close]')) closeHelpPopover();
  });
  return node;
}

function openHelpPopover(key) {
  const item = SPECIAL_OFFERS_HELP[key];
  if (!item) return;
  const node = ensureHelpPopover();
  const title = $('#specialOffersHelpTitle', node);
  const body = $('#specialOffersHelpBody', node);
  if (title) title.textContent = item.title;
  if (body) {
    body.innerHTML = `
      <dl class="special-offer-help-list">
        <div><dt>What this section does</dt><dd>${escapeHtml(item.does)}</dd></div>
        <div><dt>When to use it</dt><dd>${escapeHtml(item.use)}</dd></div>
        <div><dt>What not to do</dt><dd>${escapeHtml(item.avoid)}</dd></div>
        <div><dt>Example</dt><dd>${escapeHtml(item.example)}</dd></div>
      </dl>
    `;
  }
  node.hidden = false;
}

function closeHelpPopover() {
  const node = $('#specialOffersHelpPopover');
  if (node) node.hidden = true;
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
        <h5>FAQ builder</h5>
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
        <h5>Rules builder</h5>
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
      <p class="special-offer-editor-muted">These fields are internal/admin details. Public prize text is edited below in PL/EN/HE.</p>
      <div class="special-offer-editor-grid">
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
      </div>
      <div class="special-offer-editor-subsection">
        <h5>Prize translations PL / EN / HE</h5>
        ${renderPrizeTranslationEditor(prize)}
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
      <p class="special-offer-editor-muted">Choose Main service page for general service CTA. Choose existing offer only when you want to link to a specific car/trip/hotel/route. Custom URL is for manual links.</p>
      <div class="special-offer-editor-grid">
        <label>Link type * ${renderHelp('linkType')}
          <select data-link-field="link_type">
            ${renderOptionList(SPECIAL_OFFERS_LINK_TYPES, link.link_type || 'custom')}
          </select>
        </label>
        <label>Link mode * ${renderHelp('linkMode')}
          <select data-link-field="mode">
            ${renderLinkModeOptions(link)}
          </select>
          <span class="special-offer-field-hint">${escapeHtml(getLinkModeHint(link))}</span>
        </label>
        <label>Sort order
          <input data-link-field="sort_order" type="number" step="1" value="${escapeHtml(link.sort_order || index)}" />
        </label>
        <label>Resource ID preview
          <input value="${escapeHtml(getResourcePreviewText(link))}" readonly />
        </label>
        <label class="special-offer-editor-field--wide">Image URL
          <input data-link-field="image_url" value="${escapeHtml(link.image_url || '')}" placeholder="https://example.com/image.webp" />
          <span class="special-offer-field-hint">PL: Wklej bezpośredni adres HTTPS do zdjęcia lub lokalną ścieżkę zaczynającą się od /. EN: Paste a direct HTTPS image address or a local path beginning with /. HE: הדביקו כתובת HTTPS ישירה לתמונה או נתיב מקומי שמתחיל ב־/.</span>
        </label>
        <label class="special-offer-editor-check">
          <input data-link-field="is_primary" type="checkbox" ${link.is_primary ? 'checked' : ''} />
          Primary CTA
        </label>
      </div>
      <div class="special-offer-link-image-tools">
        <button class="btn-secondary btn-small" type="button" data-special-offers-clear-link-image="${escapeHtml(link.client_id)}">Clear image URL</button>
      </div>
      <div class="special-offer-link-image-preview" data-link-image-preview>${renderLinkImagePreview(link)}</div>
      ${renderResourcePicker(link)}
      <div class="special-offer-editor-subsection">
        <h5>Link translations PL / EN / HE</h5>
        ${renderLinkTranslationEditor(link)}
      </div>
      <div class="special-offer-url-preview" data-link-url-preview>${renderLinkUrlPreview(link)}</div>
    </article>
  `).join('');
}

function renderFormFieldEditorList() {
  const host = $('#specialOfferEditorFormFields');
  if (!host) return;
  if (!specialOffersState.editorFormFields.length) {
    host.innerHTML = '<p class="special-offers-empty-copy">No form fields yet.</p>';
    return;
  }
  const fields = [...specialOffersState.editorFormFields]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  host.innerHTML = fields.map((field, index) => renderFormFieldEditor(field, index)).join('');
}

function renderFormFieldEditor(field, index) {
  const isInactive = field.active === false;
  return `
    <article class="special-offer-editor-item${isInactive ? ' is-inactive' : ''}" data-special-offers-form-field="${escapeHtml(field.client_id)}">
      <div class="special-offer-editor-item__header">
        <strong>Field ${index + 1}: ${escapeHtml(field.field_key || 'new_field')}</strong>
        <div class="special-offer-editor-actions">
          <button class="btn-secondary btn-small" type="button" data-special-offers-duplicate-form-field="${escapeHtml(field.client_id)}">Duplicate</button>
          <button class="btn-secondary btn-small" type="button" data-special-offers-remove-form-field="${escapeHtml(field.client_id)}">${field.id ? 'Deactivate' : 'Remove'}</button>
        </div>
      </div>
      ${isInactive ? '<p class="special-offer-editor-warning">This field is inactive and will not be shown in the future public form.</p>' : ''}
      <div class="special-offer-editor-grid">
        <label>Field key * ${renderHelp('fieldKey')}
          <input data-form-field="field_key" value="${escapeHtml(field.field_key || '')}" placeholder="first_name" />
        </label>
        <label>Field type * ${renderHelp('fieldType')}
          <select data-form-field="field_type">
            ${renderOptionList(SPECIAL_OFFERS_FORM_FIELD_TYPES, field.field_type || 'text')}
          </select>
        </label>
        <label>Sort order
          <input data-form-field="sort_order" type="number" step="1" value="${escapeHtml(field.sort_order ?? index)}" />
        </label>
        <label class="special-offer-editor-check">
          <input data-form-field="required" type="checkbox" ${field.required ? 'checked' : ''} />
          Required ${renderHelp('fieldRequired')}
        </label>
        <label class="special-offer-editor-check">
          <input data-form-field="active" type="checkbox" ${field.active === false ? '' : 'checked'} />
          Active ${renderHelp('fieldActive')}
        </label>
        <label class="special-offer-editor-field--wide">Admin note
          <textarea data-form-field="admin_note" rows="2">${escapeHtml(field.admin_note || '')}</textarea>
        </label>
      </div>
      ${renderValidationBuilder(field)}
      <div class="special-offer-editor-subsection">
        <h5>Field translations PL / EN / HE</h5>
        ${renderFormFieldTranslationEditor(field)}
      </div>
    </article>
  `;
}

function renderValidationBuilder(field) {
  const validation = cloneJson(field.validation_json, {});
  const type = String(field.field_type || 'text');
  return `
    <div class="special-offer-editor-subsection" data-form-validation-builder>
      <h5>Validation ${renderHelp('fieldValidation')}</h5>
      <div class="special-offer-editor-grid">
        ${type === 'date_of_birth' ? `
          <label>Minimum age
            <input data-form-validation="min_age" type="number" min="0" step="1" value="${escapeHtml(validation.min_age ?? 18)}" />
          </label>
        ` : ''}
        ${type === 'consent' || type === 'checkbox' ? `
          <label class="special-offer-editor-check">
            <input data-form-validation="must_be_true" type="checkbox" ${validation.must_be_true === false ? '' : 'checked'} />
            Must be true
          </label>
        ` : ''}
        ${isTextValidationFieldType(type) ? `
          <label>Minimum length
            <input data-form-validation="min_length" type="number" min="0" step="1" value="${escapeHtml(validation.min_length ?? '')}" />
          </label>
          <label>Maximum length
            <input data-form-validation="max_length" type="number" min="0" step="1" value="${escapeHtml(validation.max_length ?? '')}" />
          </label>
        ` : ''}
        ${type === 'email' ? '<p class="special-offer-editor-muted special-offer-editor-field--wide">Email format validation will be enforced during the public submit stage.</p>' : ''}
        ${type === 'phone' ? '<p class="special-offer-editor-muted special-offer-editor-field--wide">The public submit stage should use the existing phone-input helper with country code support.</p>' : ''}
        ${['url', 'facebook_profile_url', 'shared_post_url'].includes(type) ? '<p class="special-offer-editor-muted special-offer-editor-field--wide">URL validation will be enforced during the public submit stage.</p>' : ''}
        <details class="special-offer-advanced-source special-offer-editor-field--wide">
          <summary>Advanced validation JSON preview</summary>
          <p class="special-offer-editor-muted">Only edit this if the normal validation controls are not enough.</p>
          <textarea data-form-validation-json rows="4">${escapeHtml(JSON.stringify(validation, null, 2))}</textarea>
        </details>
      </div>
    </div>
  `;
}

function renderFormFieldTranslationEditor(field) {
  return renderEditorSubTabs(field.client_id, 'form', (language, isActive) => {
    const translation = getFormFieldTranslation(field, language.code);
    const options = normalizeFormOptions(translation.options_json);
    return `
      <section
        class="special-offer-editor-lang-panel"
        data-special-offers-nested-lang-panel="form:${escapeHtml(field.client_id)}:${escapeHtml(language.code)}"
        dir="${escapeHtml(language.dir)}"
        ${isActive ? '' : 'hidden'}
      >
        <div class="special-offer-editor-grid">
          <label>Label
            <input data-form-translation-field="label" data-lang="${escapeHtml(language.code)}" value="${escapeHtml(translation.label || '')}" dir="${escapeHtml(language.dir)}" />
          </label>
          <label>Placeholder
            <input data-form-translation-field="placeholder" data-lang="${escapeHtml(language.code)}" value="${escapeHtml(translation.placeholder || '')}" dir="${escapeHtml(language.dir)}" />
          </label>
          <label class="special-offer-editor-field--wide">Help text
            <textarea data-form-translation-field="help_text" data-lang="${escapeHtml(language.code)}" rows="2" dir="${escapeHtml(language.dir)}">${escapeHtml(translation.help_text || '')}</textarea>
          </label>
        </div>
        ${renderOptionsBuilder(field, language, options)}
      </section>
    `;
  });
}

function renderOptionsBuilder(field, language, options) {
  const type = String(field.field_type || '');
  const hint = isOptionFieldType(type)
    ? 'Options are saved for this field type.'
    : 'Options are only used by select and checkbox group fields.';
  return `
    <div class="special-offer-builder" data-form-options-builder="${escapeHtml(field.client_id)}:${escapeHtml(language.code)}" dir="${escapeHtml(language.dir)}">
      <div class="special-offer-editor-section-head">
        <h5>Options ${renderHelp('fieldOptions')}</h5>
        <button class="btn-secondary btn-small" type="button" data-special-offers-add-form-option="${escapeHtml(field.client_id)}:${escapeHtml(language.code)}">Add option</button>
      </div>
      <p class="special-offer-editor-muted">${escapeHtml(hint)}</p>
      <div class="special-offer-builder-list" data-form-options-list="${escapeHtml(field.client_id)}:${escapeHtml(language.code)}">
        ${options.length ? options.map((option, index) => renderOptionEditorItem(option, index, language.dir)).join('') : '<p class="special-offers-empty-copy">No options yet</p>'}
      </div>
      <details class="special-offer-advanced-source">
        <summary>Advanced options JSON preview</summary>
        <pre data-form-options-json-preview="${escapeHtml(field.client_id)}:${escapeHtml(language.code)}">${escapeHtml(JSON.stringify(options, null, 2))}</pre>
      </details>
    </div>
  `;
}

function renderOptionEditorItem(option = {}, index = 0, dir = 'ltr') {
  return `
    <article class="special-offer-builder-item" data-form-option>
      <div class="special-offer-editor-item__header">
        <strong>Option ${index + 1}</strong>
        <button class="btn-secondary btn-small" type="button" data-special-offers-remove-form-option>Remove option</button>
      </div>
      <div class="special-offer-editor-grid">
        <label>Value
          <input data-form-option-field="value" value="${escapeHtml(option.value || '')}" dir="ltr" />
        </label>
        <label>Label
          <input data-form-option-field="label" value="${escapeHtml(option.label || '')}" dir="${escapeHtml(dir)}" />
        </label>
      </div>
    </article>
  `;
}

function renderEditorSubTabs(parentId, type, rowsRenderer) {
  return `
    <div class="special-offers-translation-tabs special-offers-translation-tabs--compact" role="tablist">
      ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => `
        <button
          class="special-offers-translation-tab${index === 0 ? ' is-active' : ''}"
          type="button"
          data-special-offers-nested-lang-tab="${escapeHtml(type)}:${escapeHtml(parentId)}:${escapeHtml(language.code)}"
        >${escapeHtml(language.label)}</button>
      `).join('')}
    </div>
    ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => rowsRenderer(language, index === 0)).join('')}
  `;
}

function renderPrizeTranslationEditor(prize) {
  return renderEditorSubTabs(prize.client_id, 'prize', (language, isActive) => {
    const translation = getPrizeTranslation(prize, language.code);
    return `
      <section
        class="special-offer-editor-lang-panel"
        data-special-offers-nested-lang-panel="prize:${escapeHtml(prize.client_id)}:${escapeHtml(language.code)}"
        dir="${escapeHtml(language.dir)}"
        ${isActive ? '' : 'hidden'}
      >
        <div class="special-offer-editor-grid">
          <label>Name
            <input data-prize-translation-field="name" data-lang="${escapeHtml(language.code)}" value="${escapeHtml(translation.name || '')}" dir="${escapeHtml(language.dir)}" />
          </label>
          <label class="special-offer-editor-field--wide">Description
            <textarea data-prize-translation-field="description" data-lang="${escapeHtml(language.code)}" rows="3" dir="${escapeHtml(language.dir)}">${escapeHtml(translation.description || '')}</textarea>
          </label>
          <label class="special-offer-editor-field--wide">Restrictions
            <textarea data-prize-translation-field="restrictions" data-lang="${escapeHtml(language.code)}" rows="2" dir="${escapeHtml(language.dir)}">${escapeHtml(translation.restrictions || '')}</textarea>
          </label>
          <label class="special-offer-editor-field--wide">Fulfillment notes
            <textarea data-prize-translation-field="fulfillment_notes" data-lang="${escapeHtml(language.code)}" rows="2" dir="${escapeHtml(language.dir)}">${escapeHtml(translation.fulfillment_notes || '')}</textarea>
          </label>
        </div>
      </section>
    `;
  });
}

function renderLinkTranslationEditor(link) {
  return renderEditorSubTabs(link.client_id, 'link', (language, isActive) => {
    const translation = getLinkTranslation(link, language.code);
    const defaults = getDefaultLinkTranslation(link, language.code);
    const mode = link.mode || inferLinkMode(link);
    const urlValue = mode === 'main' || mode === 'resource' ? defaults.url : (translation.url || defaults.url || '');
    return `
      <section
        class="special-offer-editor-lang-panel"
        data-special-offers-nested-lang-panel="link:${escapeHtml(link.client_id)}:${escapeHtml(language.code)}"
        dir="${escapeHtml(language.dir)}"
        ${isActive ? '' : 'hidden'}
      >
        <div class="special-offer-editor-grid">
          <label>Label
            <input data-link-translation-field="label" data-lang="${escapeHtml(language.code)}" value="${escapeHtml(translation.label || defaults.label || '')}" dir="${escapeHtml(language.dir)}" />
          </label>
          <label class="special-offer-editor-field--wide">Description
            <textarea data-link-translation-field="description" data-lang="${escapeHtml(language.code)}" rows="2" dir="${escapeHtml(language.dir)}">${escapeHtml(translation.description || defaults.description || '')}</textarea>
          </label>
          <label class="special-offer-editor-field--wide">URL
            <input data-link-translation-field="url" data-lang="${escapeHtml(language.code)}" value="${escapeHtml(urlValue)}" dir="ltr" ${mode === 'main' || mode === 'resource' ? 'readonly' : ''} />
          </label>
        </div>
      </section>
    `;
  });
}

function renderLinkModeOptions(link) {
  const selected = link.mode || inferLinkMode(link);
  return SPECIAL_OFFERS_LINK_MODES.map((mode) => {
    const disabled = isLinkModeDisabled(link.link_type, mode);
    const label = mode === 'main' ? 'Main service page' : mode === 'resource' ? 'Choose existing offer/service' : 'Custom URL';
    const reason = disabled ? ` - ${getLinkModeDisabledReason(link.link_type, mode)}` : '';
    return `<option value="${escapeHtml(mode)}" ${mode === selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(label + reason)}</option>`;
  }).join('');
}

function isLinkModeDisabled(linkType, mode) {
  const type = String(linkType || 'custom');
  if (mode === 'main') return !isMainServicePageEnabled(type) || type === 'custom';
  if (mode === 'resource') return !isResourcePickerEnabled(type);
  if (mode === 'custom') return false;
  return true;
}

function getLinkModeDisabledReason(linkType, mode) {
  const type = String(linkType || 'custom');
  if (mode === 'main') return type === 'custom' ? 'custom links use manual URL' : 'main page is not available for this type';
  if (mode === 'resource') return specialOffersState.resourceOptionsErrors[type] || SPECIAL_OFFERS_PICKER_CONFIG[type]?.disabledReason || 'picker not available for this type';
  return '';
}

function getLinkModeHint(link) {
  const mode = link.mode || inferLinkMode(link);
  if (mode === 'main') return 'Links to the general service page, for example all cars, all trips or all hotels. Use this when you do not want to promote one specific offer.';
  if (mode === 'resource') return 'Links to one specific item from the database. Use this only when you want the campaign CTA to point to a selected car, trip, hotel or route.';
  return 'Manual link. Use this for external pages or special campaign pages.';
}

function getResourcePreviewText(link) {
  if (!link.resource_id) return 'None, this link goes to a general page or custom URL.';
  const option = getResourceOption(link.link_type, link.resource_id);
  return option ? `${link.resource_id} · ${option.label}` : String(link.resource_id);
}

function renderResourcePicker(link) {
  const mode = link.mode || inferLinkMode(link);
  const type = link.link_type || 'custom';
  if (mode !== 'resource') {
    const message = type === 'shop'
      ? 'Shop picker requires public product URL resolver.'
      : type === 'coupons'
        ? 'Coupons do not have a clear public URL in this stage.'
        : type === 'vip'
          ? 'VIP supports Main service page only.'
          : 'Resource ID is disabled unless Choose existing offer/service is selected.';
    return `<p class="special-offer-editor-muted">Resource ID: disabled in this mode. ${escapeHtml(message)}</p>`;
  }
  if (!isResourcePickerEnabled(type)) {
    return `<p class="special-offer-editor-validation">${escapeHtml(getLinkModeDisabledReason(type, 'resource') || `Resource picker is disabled for ${titleCase(type)}.`)} Use Main service page or Custom URL.</p>`;
  }
  const options = toArray(specialOffersState.resourceOptions[type]);
  return `
    <div class="special-offer-resource-picker">
      <label>Choose existing ${escapeHtml(titleCase(type))}
        <select data-link-field="resource_id">
          <option value="">Select resource...</option>
          ${options.map((option) => `
            <option value="${escapeHtml(option.id)}" ${String(option.id) === String(link.resource_id || '') ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}>
              ${escapeHtml(option.label)}${option.reason ? ` - ${escapeHtml(option.reason)}` : ''}
            </option>
          `).join('')}
        </select>
      </label>
      ${specialOffersState.resourceOptionsErrors[type] ? `<p class="special-offer-editor-validation">${escapeHtml(specialOffersState.resourceOptionsErrors[type])}</p>` : ''}
      ${!options.length ? '<p class="special-offer-editor-muted">No resources loaded for this type yet.</p>' : ''}
    </div>
  `;
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

function getDefaultLinkLabel(type, lang) {
  const labels = {
    cars: { pl: 'Auta na Cyprze', en: 'Cars in Cyprus', he: 'רכבים בקפריסין' },
    trips: { pl: 'Wycieczki na Cyprze', en: 'Trips in Cyprus', he: 'טיולים בקפריסין' },
    hotels: { pl: 'Hotele na Cyprze', en: 'Hotels in Cyprus', he: 'מלונות בקפריסין' },
    transport: { pl: 'Transport na Cyprze', en: 'Transport in Cyprus', he: 'הסעות בקפריסין' },
    shop: { pl: 'Sklep', en: 'Shop', he: 'חנות' },
    vip: { pl: 'VIP Cyprus', en: 'VIP Cyprus', he: 'VIP Cyprus' },
    coupons: { pl: 'Kupony', en: 'Coupons', he: 'קופונים' },
    custom: { pl: '', en: '', he: '' },
  };
  return labels[type]?.[lang] || '';
}

function getDefaultLinkDescription(type, lang) {
  const descriptions = {
    cars: { pl: 'Wynajem auta na Cyprze z ofert CyprusEye.', en: 'Car rental in Cyprus from CyprusEye offers.', he: 'השכרת רכב בקפריסין דרך ההצעות של CyprusEye.' },
    trips: { pl: 'Wycieczki i atrakcje na Cyprze.', en: 'Trips and attractions in Cyprus.', he: 'טיולים ואטרקציות בקפריסין.' },
    hotels: { pl: 'Hotele i noclegi na Cyprze.', en: 'Hotels and stays in Cyprus.', he: 'מלונות ואירוח בקפריסין.' },
    transport: { pl: 'Transfery i transport na Cyprze.', en: 'Transfers and transport in Cyprus.', he: 'הסעות וטרנספרים בקפריסין.' },
    vip: { pl: 'Usługi VIP na Cyprze.', en: 'VIP services in Cyprus.', he: 'שירותי VIP בקפריסין.' },
  };
  return descriptions[type]?.[lang] || '';
}

function getDefaultLinkTranslation(link, lang) {
  const mode = link.mode || inferLinkMode(link);
  const type = link.link_type || 'custom';
  if (mode === 'main') {
    return {
      label: getDefaultLinkLabel(type, lang),
      description: getDefaultLinkDescription(type, lang),
      url: getGenericUrl(type, lang),
    };
  }
  if (mode === 'resource') {
    return {
      label: getDefaultLinkLabel(type, lang),
      description: getDefaultLinkDescription(type, lang),
      url: buildResourceUrl(type, link.resource_id, lang),
    };
  }
  return { label: '', description: '', url: '' };
}

function getEffectiveLinkTranslation(link, lang) {
  const existing = getLinkTranslation(link, lang);
  const defaults = getDefaultLinkTranslation(link, lang);
  const mode = link.mode || inferLinkMode(link);
  return {
    lang,
    label: String(existing.label || defaults.label || '').trim(),
    description: String(existing.description || defaults.description || '').trim(),
    url: String((mode === 'main' || mode === 'resource' ? defaults.url : existing.url || defaults.url) || '').trim(),
  };
}

function renderLinkUrlPreview(link) {
  const rows = SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language) => {
    const translation = getEffectiveLinkTranslation(link, language.code);
    return {
      lang: language.code,
      url: translation.url || '',
    };
  });
  if (!rows.some((row) => row.url)) return '<span>No URL preview yet.</span>';
  const mode = link.mode || inferLinkMode(link);
  const source = mode === 'resource' ? 'Generated from selected resource' : mode === 'main' ? 'Generated from main service page' : 'Manual URL';
  return `<strong>${escapeHtml(source)}</strong>${rows.map((row) => `<span>${escapeHtml(row.lang.toUpperCase())}: ${escapeHtml(row.url || 'Not set')}</span>`).join('')}`;
}

function renderLinkImagePreview(link) {
  const imageUrl = normalizeOptionalImageUrl(link?.image_url);
  if (!imageUrl) {
    return '<p class="special-offer-editor-muted">No image URL set. This link will render as a card without an image.</p>';
  }
  if (!isValidLinkImageUrl(imageUrl)) {
    return '<p class="special-offer-editor-validation">Image URL must be a full HTTPS image address or a local path beginning with a single /, without whitespace.</p>';
  }
  return `
    <figure class="special-offer-link-image-preview__frame">
      <img src="${escapeHtml(imageUrl)}" alt="Linked service image preview" loading="lazy" decoding="async" onerror="this.hidden=true;this.closest('[data-link-image-preview]')?.classList.add('is-unavailable');" />
      <figcaption>Image preview unavailable</figcaption>
    </figure>
  `;
}

function getCampaignEditorDefaults(campaign = null) {
  return {
    slug: campaign?.slug || '',
    type: campaign?.type || 'contest',
    winner_selection_mode: campaign?.winner_selection_mode || 'manual_selection',
    status: SPECIAL_OFFERS_EDITABLE_STATUSES.includes(campaign?.status) ? campaign.status : 'draft',
    visibility: SPECIAL_OFFERS_VISIBILITIES.includes(campaign?.visibility) ? campaign.visibility : 'private',
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
          ['form', 'Form'],
          ['rules', 'Rules/settings'],
          ['review', 'Review & save'],
        ].map(([key, label], index) => `
          <button class="special-offer-editor-tab${index === 0 ? ' is-active' : ''}" type="button" data-special-offers-editor-tab="${key}">${label}</button>
        `).join('')}
      </div>
      <div class="special-offer-editor-panels">
        <section class="special-offer-editor-section" data-special-offers-editor-panel="basic">
          <p class="special-offer-editor-muted">${renderHelp('basic')} Basic settings define internal campaign identity and controlled publication state.</p>
          <div class="special-offer-editor-grid">
            <label>Slug *
              <input name="slug" value="${escapeHtml(defaults.slug)}" placeholder="summer-giveaway-2026" required />
            </label>
            <label>Type * ${renderHelp('type')}
              <select name="type">${renderOptionList(SPECIAL_OFFERS_TYPES, defaults.type)}</select>
            </label>
            <label>Winner mode * ${renderHelp('winnerMode')}
              <select name="winner_selection_mode">${renderOptionList(SPECIAL_OFFERS_WINNER_MODES, defaults.winner_selection_mode)}</select>
            </label>
            <label>Status
              <select name="status">
                <option value="draft" ${defaults.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="scheduled" ${defaults.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="active" ${defaults.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="ended" ${defaults.status === 'ended' ? 'selected' : ''}>Ended</option>
                <option value="archived" ${defaults.status === 'archived' ? 'selected' : ''}>Archived</option>
              </select>
              <span class="special-offer-field-hint">Active makes the campaign eligible for public entry collection when visibility is Public and the current time is inside the campaign window.</span>
            </label>
            <label>Visibility
              <select name="visibility">
                <option value="private" ${defaults.visibility === 'private' ? 'selected' : ''}>Private</option>
                <option value="public" ${defaults.visibility === 'public' ? 'selected' : ''}>Public</option>
                <option value="unlisted" ${defaults.visibility === 'unlisted' ? 'selected' : ''}>Unlisted</option>
              </select>
              <span class="special-offer-field-hint">Public exposes the campaign page and allows backend RPCs to accept eligible submissions.</span>
            </label>
          </div>
          <p class="special-offer-editor-muted">Before saving Active + Public, confirm the existing production Auth flow, legal links and production smoke-test readiness.</p>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="dates" hidden>
          <p class="special-offer-editor-muted">${renderHelp('dates')} Dates are enforced by the public submit RPCs. Use local Cyprus time in this browser.</p>
          <div class="special-offer-editor-grid">
            <label>Start at
              <input name="start_at" type="datetime-local" step="1" value="${escapeHtml(defaults.start_at)}" />
            </label>
            <label>End at
              <input name="end_at" type="datetime-local" step="1" value="${escapeHtml(defaults.end_at)}" />
            </label>
            <label>Winner announce at
              <input name="winner_announce_at" type="datetime-local" step="1" value="${escapeHtml(defaults.winner_announce_at)}" />
            </label>
            <label>Timezone *
              <input name="timezone" value="${escapeHtml(defaults.timezone)}" required />
            </label>
          </div>
          <p class="special-offer-editor-muted">If Active + Public is saved after the start time and before the end time, entries can be accepted immediately.</p>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="content" hidden>
          <p class="special-offer-editor-muted">${renderHelp('content')} Edit campaign copy, FAQ items and rule sections per language.</p>
          <div class="special-offers-translation-tabs" role="tablist" aria-label="Editor translation languages">
            ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => `
              <button class="special-offers-translation-tab${index === 0 ? ' is-active' : ''}" type="button" data-special-offers-editor-lang-tab="${escapeHtml(language.code)}">${escapeHtml(language.label)}</button>
            `).join('')}
          </div>
          ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => renderTranslationEditor(campaign, language, index === 0)).join('')}
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="prize" hidden>
          <div class="special-offer-editor-section-head">
            <h4>Prize operational details ${renderHelp('prize')}</h4>
            <button class="btn-secondary btn-small" type="button" data-special-offers-add-prize>Add prize</button>
          </div>
          <p class="special-offer-editor-muted">These fields are internal/admin details. Public prize text is edited below in PL/EN/HE. Do not create separate prize rows for each language.</p>
          <div class="special-offer-editor-list" id="specialOfferEditorPrizes"></div>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="links" hidden>
          <div class="special-offer-editor-section-head">
            <h4>Linked services ${renderHelp('links')}</h4>
            <button class="btn-secondary btn-small" type="button" data-special-offers-add-link>Add link</button>
          </div>
          <p class="special-offer-editor-muted">Main service page uses general service URLs. Existing offer saves resource_id only after admin selection. Custom URL is manual per language.</p>
          <div class="special-offer-editor-list" id="specialOfferEditorLinks"></div>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="form" hidden>
          <div class="special-offer-editor-section-head">
            <h4>Form ${renderHelp('form')}</h4>
            <button class="btn-secondary btn-small" type="button" data-special-offers-add-form-field>Add field</button>
          </div>
          <p class="special-offer-editor-muted">Configure form fields only. Public submit is not available in this stage.</p>
          <div class="special-offer-editor-grid">
            <label class="special-offer-editor-check">
              <input data-offer-setting="requires_form" type="checkbox" ${defaults.requires_form ? 'checked' : ''} />
              Requires form ${renderHelp('requiresForm')}
            </label>
            <button class="btn-secondary btn-small" type="button" data-special-offers-preview-form>Preview form</button>
            <span class="special-offer-field-hint">${renderHelp('formPreview')} Preview is admin-only and submit stays disabled.</span>
          </div>
          <div class="special-offer-editor-list" id="specialOfferEditorFormFields"></div>
        </section>
        <section class="special-offer-editor-section" data-special-offers-editor-panel="rules" hidden>
          <p class="special-offer-editor-muted">${renderHelp('rules')} Configure operational campaign rules. Public launch is not available.</p>
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
          <h4>Review & save ${renderHelp('review')}</h4>
          <p class="special-offer-editor-muted">Save writes campaign data, translations, prize/link/form configuration and an audit log entry. Active + Public requires confirmation before save.</p>
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
    const translationsByLang = {};
    $$('[data-prize-translation-field]', node).forEach((field) => {
      const lang = field.getAttribute('data-lang');
      const key = field.getAttribute('data-prize-translation-field');
      if (!lang || !key) return;
      if (!translationsByLang[lang]) translationsByLang[lang] = { lang };
      translationsByLang[lang][key] = field.value;
    });
    prize.translations = SPECIAL_OFFERS_DETAIL_LANGUAGES
      .map((language) => translationsByLang[language.code] || getPrizeTranslation(prize, language.code))
      .filter(Boolean);
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
    if (link.mode !== 'resource') link.resource_id = null;
    const translationsByLang = {};
    $$('[data-link-translation-field]', node).forEach((field) => {
      const lang = field.getAttribute('data-lang');
      const key = field.getAttribute('data-link-translation-field');
      if (!lang || !key) return;
      if (!translationsByLang[lang]) translationsByLang[lang] = { lang };
      translationsByLang[lang][key] = field.value;
    });
    link.translations = SPECIAL_OFFERS_DETAIL_LANGUAGES
      .map((language) => translationsByLang[language.code] || getLinkTranslation(link, language.code))
      .filter(Boolean);
  });

  $$('#specialOfferEditorFormFields [data-special-offers-form-field]').forEach((node) => {
    const id = node.getAttribute('data-special-offers-form-field');
    const field = specialOffersState.editorFormFields.find((item) => item.client_id === id);
    if (!field) return;
    $$('[data-form-field]', node).forEach((input) => {
      const key = input.getAttribute('data-form-field');
      if (!key) return;
      field[key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    field.validation_json = collectFormFieldValidation(node, field.field_type);
    const translationsByLang = {};
    $$('[data-form-translation-field]', node).forEach((input) => {
      const lang = input.getAttribute('data-lang');
      const key = input.getAttribute('data-form-translation-field');
      if (!lang || !key) return;
      if (!translationsByLang[lang]) translationsByLang[lang] = { lang };
      translationsByLang[lang][key] = input.value;
    });
    SPECIAL_OFFERS_DETAIL_LANGUAGES.forEach((language) => {
      const key = `${field.client_id}:${language.code}`;
      const options = collectFormOptions(key);
      if (!translationsByLang[language.code]) translationsByLang[language.code] = { lang: language.code };
      translationsByLang[language.code].options_json = options;
    });
    field.translations = SPECIAL_OFFERS_DETAIL_LANGUAGES
      .map((language) => translationsByLang[language.code] || getFormFieldTranslation(field, language.code))
      .filter(Boolean);
  });
}

function collectFormFieldValidation(node, fieldType) {
  let validation = {};
  const rawJson = node.querySelector('[data-form-validation-json]')?.value;
  validation = parseEditorJson(rawJson || '{}', {}, 'object');
  const type = String(fieldType || '');
  const minAge = node.querySelector('[data-form-validation="min_age"]')?.value;
  if (type === 'date_of_birth' && String(minAge || '').trim()) {
    validation.min_age = Number(minAge);
  } else {
    delete validation.min_age;
  }
  const mustBeTrue = node.querySelector('[data-form-validation="must_be_true"]');
  if (type === 'consent' || type === 'checkbox') {
    validation.must_be_true = Boolean(mustBeTrue?.checked);
  } else {
    delete validation.must_be_true;
  }
  const minLength = node.querySelector('[data-form-validation="min_length"]')?.value;
  const maxLength = node.querySelector('[data-form-validation="max_length"]')?.value;
  if (isTextValidationFieldType(type) && String(minLength || '').trim()) validation.min_length = Number(minLength);
  else delete validation.min_length;
  if (isTextValidationFieldType(type) && String(maxLength || '').trim()) validation.max_length = Number(maxLength);
  else delete validation.max_length;
  return validation;
}

function collectFormOptions(key) {
  const list = document.querySelector(`[data-form-options-list="${key}"]`);
  if (!list) return [];
  return $$('[data-form-option]', list)
    .map((node) => ({
      value: String(node.querySelector('[data-form-option-field="value"]')?.value || '').trim(),
      label: String(node.querySelector('[data-form-option-field="label"]')?.value || '').trim(),
    }))
    .filter((option) => option.value || option.label);
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
    translations: toArray(prize.translations),
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
    mode: link.mode || inferLinkMode(link),
    resource_id: link.resource_id || null,
    url: link.url || '',
    label: link.label || '',
    description: link.description || '',
    image_url: link.image_url || '',
    is_primary: Boolean(link.is_primary),
    sort_order: link.sort_order || specialOffersState.editorLinks.length,
    translations: toArray(link.translations),
  });
  renderLinkEditorList();
  validateEditorForm();
}

function addEditorFormField(field = {}) {
  syncEditorCollectionsFromDom();
  const index = specialOffersState.editorFormFields.length;
  specialOffersState.editorFormFields.push({
    client_id: field.client_id || field.id || getTempId('form-field'),
    id: field.id || null,
    offer_id: field.offer_id || null,
    field_key: field.field_key || `custom_field_${index + 1}`,
    field_type: field.field_type || 'text',
    required: Boolean(field.required),
    active: field.active !== false,
    sort_order: Number(field.sort_order ?? index * 10),
    validation_json: cloneJson(field.validation_json, {}),
    admin_note: field.admin_note || '',
    translations: toArray(field.translations),
  });
  renderFormFieldEditorList();
  validateEditorForm();
}

function duplicateEditorFormField(clientId) {
  syncEditorCollectionsFromDom();
  const source = specialOffersState.editorFormFields.find((item) => item.client_id === clientId);
  if (!source) return;
  const nextIndex = specialOffersState.editorFormFields.length + 1;
  addEditorFormField({
    ...cloneJson(source, {}),
    id: null,
    client_id: getTempId('form-field'),
    field_key: `${String(source.field_key || 'custom_field').replace(/_copy_\d+$/, '')}_copy_${nextIndex}`,
    sort_order: Number(source.sort_order || 0) + 1,
    translations: toArray(source.translations).map((translation) => ({ ...translation, id: null })),
  });
}

function initializeEditorCollections(campaign) {
  specialOffersState.editorPrizes = toArray(campaign?.prizes).map((prize) => ({
    ...prize,
    client_id: prize.id || getTempId('prize'),
    currency: prize.currency || 'EUR',
    translations: toArray(prize.translations),
  }));
  specialOffersState.editorLinks = toArray(campaign?.links).map((link) => ({
    ...link,
    client_id: link.id || getTempId('link'),
    mode: link.mode || inferLinkMode(link),
    resource_id: link.resource_id || null,
    image_url: link.image_url || '',
    translations: toArray(link.translations),
  }));
  specialOffersState.editorFormFields = toArray(campaign?.form_fields).map((field) => ({
    ...field,
    client_id: field.id || getTempId('form-field'),
    active: field.active !== false,
    validation_json: cloneJson(field.validation_json, {}),
    translations: toArray(field.translations).map((translation) => ({
      ...translation,
      options_json: normalizeFormOptions(translation.options_json),
    })),
  }));
  specialOffersState.removedPrizeIds = new Set();
  specialOffersState.removedLinkIds = new Set();
  if (!campaign && !specialOffersState.editorPrizes.length) addEditorPrize({ sort_order: 0 });
}

async function openCampaignEditor(mode, campaignId = null) {
  const campaign = campaignId ? specialOffersState.campaigns.find((item) => item.id === campaignId) : null;
  if (mode === 'edit' && !isCampaignEditableInAdmin(campaign)) {
    setErrorState('Archived or locked campaigns cannot be edited from this launch editor.');
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
  await loadResourcePickerOptions();

  if (title) title.textContent = mode === 'edit' ? `Edit ${formatCampaignTitle(campaign)}` : 'Create campaign';
  if (subtitle) subtitle.textContent = 'Edit campaign content and controlled launch settings. Active + Public requires confirmation.';
  if (archiveButton) archiveButton.hidden = mode !== 'edit';
  body.innerHTML = renderEditorForm(campaign);
  renderPrizeEditorList();
  renderLinkEditorList();
  renderFormFieldEditorList();
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

function activateNestedLanguage(button) {
  const descriptor = button.getAttribute('data-special-offers-nested-lang-tab');
  const root = button.closest('[data-special-offers-prize], [data-special-offers-link], [data-special-offers-form-field]');
  if (!descriptor || !root) return;
  $$('[data-special-offers-nested-lang-tab]', root).forEach((tab) => {
    tab.classList.toggle('is-active', tab === button);
  });
  $$('[data-special-offers-nested-lang-panel]', root).forEach((panel) => {
    panel.hidden = panel.getAttribute('data-special-offers-nested-lang-panel') !== descriptor;
  });
}

function activateLocalDetailLanguage(button) {
  const descriptor = button.getAttribute('data-special-offers-local-tab');
  const container = button.closest('.special-offers-linked-service');
  if (!descriptor || !container) return;
  const [prefix, lang] = descriptor.split(':');
  $$('[data-special-offers-local-tab]', container).forEach((tab) => {
    const isActive = tab === button;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  $$('[data-special-offers-local-panel]', container).forEach((panel) => {
    panel.hidden = panel.getAttribute('data-special-offers-local-panel') !== `${prefix}:${lang}`;
  });
}

function refreshLinkEditorItem(linkId) {
  syncEditorCollectionsFromDom();
  const link = specialOffersState.editorLinks.find((item) => item.client_id === linkId);
  if (!link) return;
  if (link.link_type === 'custom') link.mode = 'custom';
  if (link.link_type === 'vip') link.mode = 'main';
  if (!isMainServicePageEnabled(link.link_type) && link.mode === 'main') link.mode = 'custom';
  if (!isResourcePickerEnabled(link.link_type) && link.mode === 'resource') link.mode = isMainServicePageEnabled(link.link_type) ? 'main' : 'custom';
  if (link.mode !== 'resource') link.resource_id = null;
  renderLinkEditorList();
  validateEditorForm();
}

function getEditorFieldValue(form, name) {
  return String(form.elements[name]?.value || '').trim();
}

function getEditorFieldChecked(form, name) {
  return Boolean(form.elements[name]?.checked);
}

function getEditorRequiresFormChecked(form) {
  const formTabInput = form.querySelector('[data-offer-setting="requires_form"]');
  if (formTabInput) return Boolean(formTabInput.checked);
  return getEditorFieldChecked(form, 'requires_form');
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

  const rawStatus = getEditorFieldValue(form, 'status') || 'draft';
  const status = SPECIAL_OFFERS_EDITABLE_STATUSES.includes(rawStatus) ? rawStatus : 'draft';
  const rawVisibility = getEditorFieldValue(form, 'visibility') || 'private';
  const visibility = SPECIAL_OFFERS_VISIBILITIES.includes(rawVisibility) ? rawVisibility : 'private';
  if (form.elements.status && form.elements.status.value !== status) {
    form.elements.status.value = status;
  }
  if (form.elements.visibility && form.elements.visibility.value !== visibility) {
    form.elements.visibility.value = visibility;
  }
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
    requires_form: getEditorRequiresFormChecked(form),
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

  const prizes = specialOffersState.editorPrizes.map((prize, index) => {
    const translations = SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language) => {
      const row = getPrizeTranslation(prize, language.code);
      const translation = {
        lang: language.code,
        name: String(row.name || '').trim(),
        description: String(row.description || '').trim(),
        restrictions: String(row.restrictions || '').trim(),
        fulfillment_notes: String(row.fulfillment_notes || '').trim(),
      };
      const hasData = Object.entries(translation).some(([key, value]) => key !== 'lang' && String(value || '').trim());
      return hasData ? translation : null;
    }).filter(Boolean);
    const plPrize = translations.find((item) => item.lang === 'pl') || translations[0] || {};
    return {
      client_id: prize.client_id,
      id: prize.id || null,
      name: String(prize.name || plPrize.name || `Prize ${index + 1}`).trim(),
      description: String(prize.description || plPrize.description || '').trim() || null,
    sponsor_name: String(prize.sponsor_name || '').trim() || null,
    quantity: Number(prize.quantity || 1),
    value_estimate: String(prize.value_estimate || '').trim() ? Number(prize.value_estimate) : null,
    currency: String(prize.currency || 'EUR').trim() || 'EUR',
      restrictions: String(prize.restrictions || plPrize.restrictions || '').trim() || null,
      fulfillment_notes: String(prize.fulfillment_notes || plPrize.fulfillment_notes || '').trim() || null,
    sort_order: Number(prize.sort_order || index),
      translations,
    };
  });

  const links = specialOffersState.editorLinks.map((link, index) => {
    const mode = String(link.mode || inferLinkMode(link));
    const translations = SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language) => {
      const translation = getEffectiveLinkTranslation(link, language.code);
      const hasData = Object.entries(translation).some(([key, value]) => key !== 'lang' && String(value || '').trim());
      return hasData ? translation : null;
    }).filter(Boolean);
    const plLink = translations.find((item) => item.lang === 'pl') || translations[0] || {};
    return {
      client_id: link.client_id,
      id: link.id || null,
      link_type: String(link.link_type || '').trim(),
      mode,
      resource_id: mode === 'resource' ? String(link.resource_id || '').trim() || null : null,
      url: String(link.url || plLink.url || '').trim(),
      label: String(link.label || plLink.label || '').trim(),
      description: String(link.description || plLink.description || '').trim() || null,
      image_url: normalizeOptionalImageUrl(link.image_url),
      is_primary: Boolean(link.is_primary),
      sort_order: Number(link.sort_order || index),
      translations,
    };
  });

  const formFields = specialOffersState.editorFormFields.map((field, index) => {
    const translations = SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language) => {
      const row = getFormFieldTranslation(field, language.code);
      const translation = {
        lang: language.code,
        label: String(row.label || '').trim(),
        placeholder: String(row.placeholder || '').trim() || null,
        help_text: String(row.help_text || '').trim() || null,
        options_json: normalizeFormOptions(row.options_json),
      };
      const hasData = translation.label
        || translation.placeholder
        || translation.help_text
        || translation.options_json.length;
      return hasData ? translation : null;
    }).filter(Boolean);
    return {
      client_id: field.client_id,
      id: field.id || null,
      field_key: String(field.field_key || '').trim().toLowerCase(),
      field_type: String(field.field_type || '').trim(),
      required: Boolean(field.required),
      active: field.active !== false,
      sort_order: Number(field.sort_order ?? index),
      validation_json: cloneJson(field.validation_json, {}),
      admin_note: String(field.admin_note || '').trim() || null,
      translations,
    };
  });

  return { offer, translations, prizes, links, formFields };
}

function validateEditorPayload(payload) {
  const errors = [];
  if (!payload.offer.slug) errors.push('Basic settings: slug is required.');
  if (payload.offer.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.offer.slug)) errors.push('Basic settings: slug must be lowercase URL-safe text.');
  if (!SPECIAL_OFFERS_TYPES.includes(payload.offer.type)) errors.push('Basic settings: type is required.');
  if (!SPECIAL_OFFERS_WINNER_MODES.includes(payload.offer.winner_selection_mode)) errors.push('Basic settings: winner mode is required.');
  if (!SPECIAL_OFFERS_EDITABLE_STATUSES.includes(payload.offer.status)) errors.push('Basic settings: status is invalid.');
  if (!SPECIAL_OFFERS_VISIBILITIES.includes(payload.offer.visibility)) errors.push('Basic settings: visibility is invalid.');
  if (payload.offer.status === 'locked') errors.push('Basic settings: locked campaigns are only set by emergency pause.');
  if (!payload.offer.timezone) errors.push('Dates & visibility: timezone is required.');
  if (payload.offer.start_at && payload.offer.end_at && new Date(payload.offer.end_at) <= new Date(payload.offer.start_at)) errors.push('Dates & visibility: end at must be after start at.');
  if (payload.offer.status === 'active' && payload.offer.visibility === 'public') {
    if (!payload.offer.start_at) errors.push('Dates & visibility: start at is required before publishing Active + Public.');
    if (!payload.offer.end_at) errors.push('Dates & visibility: end at is required before publishing Active + Public.');
    if (payload.offer.requires_form !== true) errors.push('Rules/settings: requires form must stay enabled before publishing Active + Public.');
    if (payload.offer.requires_manual_approval !== true) errors.push('Rules/settings: manual approval must stay enabled before publishing Active + Public.');
    if (payload.offer.winner_selection_mode !== 'manual_selection') errors.push('Basic settings: Lefkara launch requires manual winner selection.');
  }
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
      if (!section.title && section.bullets.length) errors.push(`Content ${language.label}: rule section ${index + 1} needs a section title when bullets exist.`);
      if (section.title && !section.bullets.length) errors.push(`Content ${language.label}: rule section ${index + 1} needs at least one bullet.`);
    });
  });
  payload.prizes.forEach((prize, index) => {
    if (!prize.name) errors.push(`Prize operational details: prize ${index + 1} name is required.`);
    if (prize.quantity < 1) errors.push(`Prize operational details: prize ${index + 1} quantity must be at least 1.`);
    const plPrize = prize.translations.find((item) => item.lang === 'pl');
    if (plPrize && !plPrize.name) errors.push(`Prize PL: prize ${index + 1} name should not be empty when PL translation exists.`);
    prize.translations.forEach((translation) => {
      const hasAny = ['description', 'restrictions', 'fulfillment_notes'].some((key) => String(translation[key] || '').trim());
      if ((hasAny || translation.lang !== 'pl') && !translation.name) {
        errors.push(`Prize ${getLanguageLabel(translation.lang)}: prize ${index + 1} name is required when this language has prize copy.`);
      }
    });
  });
  payload.links.forEach((link, index) => {
    if (!SPECIAL_OFFERS_LINK_TYPES.includes(link.link_type)) errors.push(`Linked services: link ${index + 1} type is required.`);
    if (!SPECIAL_OFFERS_LINK_MODES.includes(link.mode)) errors.push(`Linked services: link ${index + 1} mode is required.`);
    if (link.mode === 'main' && !isMainServicePageEnabled(link.link_type)) errors.push(`Linked services: link ${index + 1} main service page is not available for ${titleCase(link.link_type)}.`);
    if (link.mode === 'resource' && !isResourcePickerEnabled(link.link_type)) errors.push(`Linked services: link ${index + 1}: Choose existing offer/service is not available for this link type yet. Use Main service page or Custom URL.`);
    if (link.mode === 'resource' && !link.resource_id) errors.push(`Linked services: link ${index + 1} resource_id is required for existing resource mode.`);
    link.translations.forEach((translation) => {
      const hasAny = ['label', 'description', 'url'].some((key) => String(translation[key] || '').trim());
      if (!hasAny) return;
      if (!translation.label) errors.push(`Linked services ${getLanguageLabel(translation.lang)}: link ${index + 1} label is required.`);
      if (!translation.url) errors.push(`Linked services ${getLanguageLabel(translation.lang)}: link ${index + 1} URL is required.`);
      if (translation.url && !isValidUrlForStage(translation.url)) errors.push(`Linked services ${getLanguageLabel(translation.lang)}: link ${index + 1} URL must be relative or http(s).`);
    });
    if (!link.label) errors.push(`Linked services: link ${index + 1} fallback label is required.`);
    if (!link.url) errors.push(`Linked services: link ${index + 1} fallback URL is required.`);
    if (link.url && !isValidUrlForStage(link.url)) errors.push(`Linked services: link ${index + 1} fallback URL must be relative or http(s).`);
    if (!isValidLinkImageUrl(link.image_url)) errors.push(`Linked services: link ${index + 1} Image URL must be HTTPS or a local path beginning with a single /, without whitespace, up to 2048 characters.`);
  });
  if (payload.links.filter((link) => link.is_primary).length > 1) errors.push('Linked services: only one primary CTA is allowed.');
  const seenFieldKeys = new Set();
  payload.formFields.forEach((field, index) => {
    const label = `Form: field ${index + 1}`;
    if (!field.field_key) errors.push(`${label} field_key is required.`);
    if (field.field_key && !isValidFormFieldKey(field.field_key)) errors.push(`${label} field_key must use lowercase a-z, 0-9 and underscore only.`);
    if (seenFieldKeys.has(field.field_key)) errors.push(`${label} field_key must be unique per campaign.`);
    if (field.field_key) seenFieldKeys.add(field.field_key);
    if (!SPECIAL_OFFERS_FORM_FIELD_TYPES.includes(field.field_type)) errors.push(`${label} field_type is not supported by the database CHECK constraint.`);
    if (!Number.isFinite(field.sort_order)) errors.push(`${label} sort order must be a number.`);
    if (field.validation_json && (Array.isArray(field.validation_json) || typeof field.validation_json !== 'object')) errors.push(`${label} validation JSON must be an object.`);
    if (field.field_type === 'date_of_birth' && field.validation_json.min_age !== undefined && Number(field.validation_json.min_age) < 0) {
      errors.push(`${label} minimum age must be zero or greater.`);
    }
    if (field.validation_json.min_length !== undefined && Number(field.validation_json.min_length) < 0) errors.push(`${label} minimum length must be zero or greater.`);
    if (field.validation_json.max_length !== undefined && Number(field.validation_json.max_length) < 0) errors.push(`${label} maximum length must be zero or greater.`);
    if (
      field.validation_json.min_length !== undefined
      && field.validation_json.max_length !== undefined
      && Number(field.validation_json.max_length) < Number(field.validation_json.min_length)
    ) {
      errors.push(`${label} maximum length cannot be smaller than minimum length.`);
    }
    const plField = field.translations.find((item) => item.lang === 'pl');
    if (field.active && !plField?.label) errors.push(`${label} PL label is required for active fields.`);
    field.translations.forEach((translation) => {
      const hasAny = translation.label || translation.placeholder || translation.help_text || toArray(translation.options_json).length;
      if (hasAny && !translation.label) errors.push(`Form ${getLanguageLabel(translation.lang)}: ${field.field_key || `field ${index + 1}`} label is required when translation data exists.`);
      if (isOptionFieldType(field.field_type)) {
        toArray(translation.options_json).forEach((option, optionIndex) => {
          if (!option.value || !option.label) {
            errors.push(`Form ${getLanguageLabel(translation.lang)}: ${field.field_key || `field ${index + 1}`} option ${optionIndex + 1} needs both value and label.`);
          }
        });
      }
    });
    if (isOptionFieldType(field.field_type)) {
      const plOptions = toArray(plField?.options_json);
      if (field.active && !plOptions.length) errors.push(`${label} needs at least one PL option for ${field.field_type}.`);
    }
  });
  return errors;
}

function requiresPublishConfirmation(payload, existingCampaign) {
  if (payload?.offer?.status !== 'active' || payload?.offer?.visibility !== 'public') return false;
  if (!existingCampaign) return true;
  return existingCampaign.status !== 'active'
    || existingCampaign.visibility !== 'public'
    || existingCampaign.start_at !== payload.offer.start_at
    || existingCampaign.end_at !== payload.offer.end_at;
}

function confirmCampaignPublish(payload) {
  const start = payload?.offer?.start_at ? new Date(payload.offer.start_at) : null;
  const end = payload?.offer?.end_at ? new Date(payload.offer.end_at) : null;
  const now = new Date();
  const insideWindow = start && end && start <= now && now <= end;
  const lines = [
    'Publish this campaign as Active + Public?',
    '',
    `Start: ${formatDetailValue(payload?.offer?.start_at)}`,
    `End: ${formatDetailValue(payload?.offer?.end_at)}`,
    '',
    insideWindow
      ? 'The start date has already passed and the current time is before the end date. After saving, the campaign can immediately accept entries.'
      : 'After saving, the campaign will follow the configured start/end window.',
    '',
    'Confirm only after the existing production Auth flow, legal links and the launch checklist are complete.',
  ];
  return window.confirm(lines.join('\n'));
}

function collectEditorWarnings(payload) {
  const warnings = [];
  payload.prizes.forEach((prize, index) => {
    if (!prize.translations.find((item) => item.lang === 'pl' && item.name)) {
      warnings.push(`Prize: prize ${index + 1} should have a PL prize name before final review.`);
    }
    ['en', 'he'].forEach((lang) => {
      if (!prize.translations.find((item) => item.lang === lang && item.name)) {
        warnings.push(`Prize ${getLanguageLabel(lang)}: prize ${index + 1} public copy is missing.`);
      }
    });
  });
  payload.links.forEach((link, index) => {
    const missing = SPECIAL_OFFERS_DETAIL_LANGUAGES
      .filter((language) => !link.translations.find((item) => item.lang === language.code && item.label && item.url))
      .map((language) => language.label);
    if (missing.length) warnings.push(`Linked services: link ${index + 1} is missing ${missing.join('/')} label or URL.`);
  });
  payload.formFields.forEach((field) => {
    if (!field.active) return;
    ['en', 'he'].forEach((lang) => {
      if (!field.translations.find((item) => item.lang === lang && item.label)) {
        warnings.push(`Form ${getLanguageLabel(lang)}: ${field.field_key} label is missing.`);
      }
    });
  });
  return warnings;
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
  let warnings = [];
  try {
    warnings = collectEditorWarnings(collectEditorPayload());
  } catch (_error) {
    warnings = [];
  }
  updateEditorReview(errors, warnings);
  return errors;
}

function updateEditorReview(errors = [], warnings = []) {
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
        ['Prize translations', payload.prizes.reduce((sum, prize) => sum + prize.translations.length, 0)],
        ['Links', payload.links.length],
        ['Link translations', payload.links.reduce((sum, link) => sum + link.translations.length, 0)],
        ['Form fields', payload.formFields.length],
        ['Active form fields', payload.formFields.filter((field) => field.active).length],
        ['Form field translations', payload.formFields.reduce((sum, field) => sum + field.translations.length, 0)],
        ['Primary CTA coverage', payload.links.find((link) => link.is_primary)?.translations.map((item) => item.lang.toUpperCase()).join(', ') || 'No primary CTA'],
      ])}
    </div>
    ${errors.length ? `<p class="special-offer-editor-validation">${escapeHtml(errors.join(' '))}</p>` : '<p class="special-offer-editor-success">Ready to save campaign.</p>'}
    ${warnings.length ? `<p class="special-offer-editor-warning">${escapeHtml(warnings.join(' '))}</p>` : ''}
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
      stage: '3C.2',
      localized_prize_links: true,
      form_builder: true,
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

async function savePrizeTranslations(client, prizeId, translations) {
  for (const translation of toArray(translations)) {
    const hasData = ['name', 'description', 'restrictions', 'fulfillment_notes'].some((key) => String(translation[key] || '').trim());
    if (!hasData) continue;
    const result = await client.from('special_offer_prize_translations').upsert(
      { ...translation, prize_id: prizeId },
      { onConflict: 'prize_id,lang' },
    );
    assertSupabaseResult(result, 'Failed to save prize translation.');
  }
}

async function saveLinkTranslations(client, linkId, translations) {
  for (const translation of toArray(translations)) {
    const hasData = ['label', 'description', 'url'].some((key) => String(translation[key] || '').trim());
    if (!hasData) continue;
    const result = await client.from('special_offer_link_translations').upsert(
      { ...translation, link_id: linkId },
      { onConflict: 'link_id,lang' },
    );
    assertSupabaseResult(result, 'Failed to save link translation.');
  }
}

async function saveFormFieldTranslations(client, fieldId, translations) {
  for (const translation of toArray(translations)) {
    const hasData = ['label', 'placeholder', 'help_text'].some((key) => String(translation[key] || '').trim())
      || toArray(translation.options_json).length > 0;
    if (!hasData) continue;
    const result = await client.from('special_offer_form_field_translations').upsert(
      { ...translation, field_id: fieldId },
      { onConflict: 'field_id,lang' },
    );
    assertSupabaseResult(result, 'Failed to save form field translation.');
  }
}

async function saveFormFields(client, offerId, formFields) {
  for (const field of formFields) {
    const { translations, client_id: _clientId, ...fieldData } = field;
    const payload = { ...fieldData, offer_id: offerId };
    let fieldId = payload.id;
    if (payload.id) {
      delete payload.id;
      assertSupabaseResult(await client.from('special_offer_form_fields').update(payload).eq('id', fieldId), 'Failed to update form field.');
    } else {
      delete payload.id;
      const inserted = assertSupabaseResult(
        await client.from('special_offer_form_fields').insert(payload).select(SPECIAL_OFFERS_FORM_FIELDS_SELECT).single(),
        'Failed to insert form field.',
      );
      fieldId = inserted?.id;
    }
    if (!fieldId) throw new Error('Failed to resolve saved form field ID.');
    await saveFormFieldTranslations(client, fieldId, translations);
  }
}

async function savePrizes(client, offerId, prizes) {
  for (const prizeId of specialOffersState.removedPrizeIds) {
    assertSupabaseResult(await client.from('special_offer_prizes').delete().eq('id', prizeId), 'Failed to remove prize.');
  }
  for (const prize of prizes) {
    const { translations, client_id: _clientId, ...prizeData } = prize;
    const payload = { ...prizeData, offer_id: offerId };
    let prizeId = payload.id;
    if (payload.id) {
      delete payload.id;
      assertSupabaseResult(await client.from('special_offer_prizes').update(payload).eq('id', prizeId), 'Failed to update prize.');
    } else {
      delete payload.id;
      const inserted = assertSupabaseResult(
        await client.from('special_offer_prizes').insert(payload).select(SPECIAL_OFFERS_PRIZES_SELECT).single(),
        'Failed to insert prize.',
      );
      prizeId = inserted?.id;
    }
    if (!prizeId) throw new Error('Failed to resolve saved prize ID.');
    await savePrizeTranslations(client, prizeId, translations);
  }
}

async function saveLinks(client, offerId, links) {
  for (const linkId of specialOffersState.removedLinkIds) {
    assertSupabaseResult(await client.from('special_offer_links').delete().eq('id', linkId), 'Failed to remove link.');
  }
  for (const link of links) {
    const { translations, client_id: _clientId, mode: _mode, ...linkData } = link;
    const payload = { ...linkData, offer_id: offerId };
    let linkId = payload.id;
    if (payload.id) {
      delete payload.id;
      assertSupabaseResult(await client.from('special_offer_links').update(payload).eq('id', linkId), 'Failed to update link.');
    } else {
      delete payload.id;
      const inserted = assertSupabaseResult(
        await client.from('special_offer_links').insert(payload).select(SPECIAL_OFFERS_LINKS_SELECT).single(),
        'Failed to insert link.',
      );
      linkId = inserted?.id;
    }
    if (!linkId) throw new Error('Failed to resolve saved link ID.');
    await saveLinkTranslations(client, linkId, translations);
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
  if (requiresPublishConfirmation(payload, existingCampaign) && !confirmCampaignPublish(payload)) return;

  const oldSnapshot = buildCampaignSnapshot(existingCampaign);
  setEditorSaving(true);
  setEditorMessage('');

  try {
    const actorId = await getAuditActorId(client);
    let offerId = existingCampaign?.id || null;
    const offerPayload = {
      ...payload.offer,
      updated_by: actorId,
      archived_at: payload.offer.status === 'archived' ? new Date().toISOString() : null,
    };

    if (specialOffersState.editorMode === 'create') {
      offerPayload.created_by = actorId;
      const inserted = assertSupabaseResult(
        await client.from('special_offers').insert(offerPayload).select(SPECIAL_OFFERS_SELECT).single(),
        'Failed to create campaign.',
      );
      offerId = inserted.id;
    } else {
      if (!isCampaignEditableInAdmin(existingCampaign)) throw new Error('Archived or locked campaigns cannot be edited from this launch editor.');
      assertSupabaseResult(await client.from('special_offers').update(offerPayload).eq('id', offerId), 'Failed to update campaign.');
    }

    await saveTranslations(client, offerId, payload.translations);
    await savePrizes(client, offerId, payload.prizes);
    await saveLinks(client, offerId, payload.links);
    await saveFormFields(client, offerId, payload.formFields);

    let auditWarning = '';
    try {
      await insertSpecialOfferAudit(
        client,
        specialOffersState.editorMode === 'create' ? 'special_offer.created' : 'special_offer.updated',
        offerId,
        specialOffersState.editorMode === 'create' ? null : oldSnapshot,
        { ...buildCampaignSnapshot({ ...payload.offer, id: offerId, translations: payload.translations, prizes: payload.prizes, links: payload.links, form_fields: payload.formFields }), stage: '3C.2', localized_prize_links: true, form_builder: true },
      );
    } catch (auditError) {
      console.error('Special Offers audit insert failed:', auditError);
      auditWarning = ' Saved, but audit log insert failed.';
    }

    await refreshSpecialOffers();
    closeCampaignEditor();
    setErrorState('');
    setHeaderStatus(`Saved campaign.${auditWarning}`, auditWarning ? 'pending' : 'ready');
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
  const canEdit = isCampaignEditableInAdmin(campaign);

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
          <h4>Public landing preview URLs</h4>
          ${renderPublicLandingPreviewLinks(campaign)}
        </section>
        <section class="special-offers-detail-panel special-offers-detail-panel--wide">
          <h4>Audit log</h4>
          ${renderAuditLog(campaign.audit_log)}
        </section>
        <section class="special-offers-detail-panel special-offers-detail-panel--wide">
          <h4>Settings summary</h4>
          ${renderSettingsSummary(campaign.settings_json || {})}
          <div class="special-offers-disabled-actions">
            <button class="btn-secondary btn-small" type="button" data-special-offers-preview="${escapeHtml(campaign.id)}">Preview campaign</button>
            <button
              class="btn-secondary btn-small"
              type="button"
              data-special-offers-edit="${escapeHtml(campaign.id)}"
              ${canEdit ? '' : 'disabled title="Archived or locked campaigns cannot be edited."'}
            >Edit campaign</button>
            <button class="btn-secondary btn-small" type="button" data-special-offers-open-entries="${escapeHtml(campaign.id)}">Entries</button>
            <button class="btn-secondary btn-small" type="button" data-special-offers-open-manual-verification="${escapeHtml(campaign.id)}">Manual verification</button>
            <button class="btn-secondary btn-small" type="button" data-special-offers-open-manual-winner="${escapeHtml(campaign.id)}" ${campaign.winner_selection_mode === 'manual_selection' ? '' : 'disabled title="Manual winner selection requires winner_selection_mode = manual_selection."'}>Manual winner selection</button>
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

function ensureEntriesModal() {
  let modal = $('#specialOffersEntriesModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-entries-modal';
  modal.id = 'specialOffersEntriesModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-entries-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOffersEntriesTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Admin entries</div>
          <h3 id="specialOffersEntriesTitle">Entries</h3>
          <p class="special-offer-editor-subtitle">Read-only submission list. Review decisions go through review_special_offer_entry.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-entries-close aria-label="Close entries">×</button>
      </header>
      <div class="admin-modal-body" id="specialOffersEntriesBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-entries-close]')) closeEntriesModal();
    const detailButton = target?.closest('[data-special-offers-entry-detail]');
    if (detailButton) openEntryDetails(detailButton.getAttribute('data-special-offers-entry-detail'));
    const refreshButton = target?.closest('[data-special-offers-entry-refresh]');
    if (refreshButton) refreshEntriesList();
    const pageButton = target?.closest('[data-special-offers-entry-page]');
    if (pageButton && !pageButton.disabled) {
      const direction = pageButton.getAttribute('data-special-offers-entry-page');
      specialOffersState.entries.page += direction === 'next' ? 1 : -1;
      refreshEntriesList();
    }
  });
  modal.addEventListener('change', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const status = target?.closest('[data-special-offers-entry-status]');
    const offer = target?.closest('[data-special-offers-entry-offer]');
    if (status) {
      specialOffersState.entries.status = status.value || 'all';
      specialOffersState.entries.page = 1;
      refreshEntriesList();
    }
    if (offer) {
      specialOffersState.entries.offerId = offer.value || 'all';
      specialOffersState.entries.page = 1;
      refreshEntriesList();
    }
  });
  modal.addEventListener('input', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const input = target?.closest('[data-special-offers-entry-search]');
    if (!input) return;
    specialOffersState.entries.search = input.value || '';
    specialOffersState.entries.page = 1;
    window.clearTimeout(specialOffersState.entries.searchTimer);
    specialOffersState.entries.searchTimer = window.setTimeout(() => refreshEntriesList(), 250);
  });
  return modal;
}

function ensureEntryDetailsModal() {
  let modal = $('#specialOfferEntryDetailsModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-entry-detail-modal';
  modal.id = 'specialOfferEntryDetailsModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-entry-detail-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOfferEntryDetailsTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Entry review</div>
          <h3 id="specialOfferEntryDetailsTitle">Entry details</h3>
          <p class="special-offer-editor-subtitle">Answers and snapshots are read-only.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-entry-detail-close aria-label="Close entry details">×</button>
      </header>
      <div class="admin-modal-body" id="specialOfferEntryDetailsBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-entry-detail-close]')) closeEntryDetails();
    const fullFormButton = target?.closest('[data-special-offers-entry-full-form]');
    if (fullFormButton) {
      openEntryFullForm(fullFormButton.getAttribute('data-special-offers-entry-full-form') || '');
    }
    const activityDetailButton = target?.closest('[data-special-offers-activity-detail]');
    if (activityDetailButton) {
      openActivityDetail(activityDetailButton.getAttribute('data-special-offers-activity-detail') || '');
    }
    const actionButton = target?.closest('[data-special-offers-review-action]');
    if (actionButton) {
      specialOffersState.entries.reviewAction = actionButton.getAttribute('data-special-offers-review-action') || '';
      renderEntryDetails();
    }
    if (target?.closest('[data-special-offers-review-cancel]')) {
      specialOffersState.entries.reviewAction = '';
      renderEntryDetails();
    }
    if (target?.closest('[data-special-offers-entry-delete-open]')) {
      specialOffersState.entries.deleteOpen = true;
      renderEntryDetails();
    }
    if (target?.closest('[data-special-offers-entry-delete-cancel]')) {
      specialOffersState.entries.deleteOpen = false;
      renderEntryDetails();
    }
  });
  modal.addEventListener('input', updateReviewCharacterCounters);
  modal.addEventListener('submit', (event) => {
    const deleteForm = event.target instanceof Element ? event.target.closest('[data-special-offers-entry-delete-form]') : null;
    if (deleteForm) {
      event.preventDefault();
      submitEntryDelete(deleteForm);
      return;
    }
    const form = event.target instanceof Element ? event.target.closest('[data-special-offers-review-form]') : null;
    if (!form) return;
    event.preventDefault();
    submitEntryReview(form);
  });
  return modal;
}

function closeEntriesModal() {
  const modal = $('#specialOffersEntriesModal');
  if (modal) modal.hidden = true;
}

function closeEntryDetails() {
  const modal = $('#specialOfferEntryDetailsModal');
  if (modal) modal.hidden = true;
  specialOffersState.entries.selectedEntryId = null;
  specialOffersState.entries.detail = null;
  specialOffersState.entries.reviewAction = '';
  specialOffersState.entries.deleteOpen = false;
  specialOffersState.entries.deleting = false;
}

function renderEntriesModal() {
  const modal = ensureEntriesModal();
  const body = $('#specialOffersEntriesBody', modal);
  if (body) body.innerHTML = renderEntriesModalBody();
  modal.hidden = false;
}

async function refreshEntriesList() {
  const modal = ensureEntriesModal();
  const body = $('#specialOffersEntriesBody', modal);
  specialOffersState.entries.loading = true;
  specialOffersState.entries.error = '';
  if (body) body.innerHTML = renderEntriesModalBody();
  try {
    const [counts, page] = await Promise.all([
      loadEntryCounts(specialOffersState.entries),
      loadEntriesPage(),
    ]);
    specialOffersState.entryCounts = counts;
    specialOffersState.entries.rows = page.rows;
    specialOffersState.entries.total = page.total;
    renderStats(specialOffersState.campaigns);
  } catch (error) {
    specialOffersState.entries.rows = [];
    specialOffersState.entries.total = 0;
    specialOffersState.entries.error = 'Unable to load entries. Check admin access and Special Offers RLS.';
  } finally {
    specialOffersState.entries.loading = false;
    if (body) body.innerHTML = renderEntriesModalBody();
  }
}

async function openEntriesModal(offerId = 'all') {
  specialOffersState.entries.offerId = offerId || 'all';
  specialOffersState.entries.page = 1;
  renderEntriesModal();
  await refreshEntriesList();
}

function ensureManualVerificationModal() {
  let modal = $('#specialOffersManualVerificationModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-manual-verification-modal';
  modal.id = 'specialOffersManualVerificationModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-manual-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOffersManualVerificationTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Manual verification</div>
          <h3 id="specialOffersManualVerificationTitle">Official posts, activity claims and points</h3>
          <p class="special-offer-editor-subtitle">Admin-only workflow. Write actions use Special Offers verification RPCs.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-manual-close aria-label="Close manual verification">×</button>
      </header>
      <div class="admin-modal-body" id="specialOffersManualVerificationBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-manual-close]')) closeManualVerificationModal();
    if (target?.closest('[data-special-offers-manual-refresh]')) refreshManualVerification();
    if (target?.closest('[data-special-offers-post-new]')) {
      specialOffersState.manualVerification.postEditingId = 'new';
      renderManualVerificationModal();
    }
    const editPost = target?.closest('[data-special-offers-post-edit]');
    if (editPost) {
      specialOffersState.manualVerification.postEditingId = editPost.getAttribute('data-special-offers-post-edit') || '';
      renderManualVerificationModal();
    }
    if (target?.closest('[data-special-offers-post-cancel]')) {
      specialOffersState.manualVerification.postEditingId = '';
      renderManualVerificationModal();
    }
    const deactivatePost = target?.closest('[data-special-offers-post-deactivate]');
    if (deactivatePost && !deactivatePost.disabled) {
      deactivateOfficialPost(deactivatePost.getAttribute('data-special-offers-post-deactivate') || '');
    }
    const deletePost = target?.closest('[data-special-offers-post-delete]');
    if (deletePost && !deletePost.disabled) {
      openOfficialPostDeleteModal(deletePost.getAttribute('data-special-offers-post-delete') || '', deletePost);
    }
    const activityDetail = target?.closest('[data-special-offers-activity-detail]');
    if (activityDetail) openActivityDetail(activityDetail.getAttribute('data-special-offers-activity-detail') || '');
    const pageButton = target?.closest('[data-special-offers-activity-page]');
    if (pageButton && !pageButton.disabled) {
      const direction = pageButton.getAttribute('data-special-offers-activity-page');
      specialOffersState.manualVerification.activities.page += direction === 'next' ? 1 : -1;
      refreshActivityQueue();
    }
  });
  modal.addEventListener('change', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const offer = target?.closest('[data-special-offers-manual-offer]');
    const status = target?.closest('[data-special-offers-activity-status]');
    const type = target?.closest('[data-special-offers-activity-type]');
    const post = target?.closest('[data-special-offers-activity-post]');
    if (offer) {
      specialOffersState.manualVerification.offerId = offer.value || 'all';
      specialOffersState.manualVerification.activities.officialPostId = 'all';
      specialOffersState.manualVerification.activities.page = 1;
      specialOffersState.manualVerification.postEditingId = '';
      refreshManualVerification();
    }
    if (status) {
      specialOffersState.manualVerification.activities.status = status.value || 'all';
      specialOffersState.manualVerification.activities.page = 1;
      refreshActivityQueue();
    }
    if (type) {
      specialOffersState.manualVerification.activities.activityType = type.value || 'all';
      specialOffersState.manualVerification.activities.page = 1;
      refreshActivityQueue();
    }
    if (post) {
      specialOffersState.manualVerification.activities.officialPostId = post.value || 'all';
      specialOffersState.manualVerification.activities.page = 1;
      refreshActivityQueue();
    }
  });
  modal.addEventListener('input', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const search = target?.closest('[data-special-offers-activity-search]');
    if (!search) return;
    specialOffersState.manualVerification.activities.search = search.value || '';
    specialOffersState.manualVerification.activities.page = 1;
    window.clearTimeout(specialOffersState.manualVerification.activities.searchTimer);
    specialOffersState.manualVerification.activities.searchTimer = window.setTimeout(() => refreshActivityQueue(), 250);
  });
  modal.addEventListener('submit', (event) => {
    const form = event.target instanceof Element ? event.target.closest('[data-special-offers-post-form]') : null;
    if (!form) return;
    event.preventDefault();
    submitOfficialPost(form);
  });
  return modal;
}

function closeManualVerificationModal() {
  const modal = $('#specialOffersManualVerificationModal');
  if (modal) modal.hidden = true;
  closeOfficialPostDeleteModal();
}

function renderManualVerificationModal() {
  const modal = ensureManualVerificationModal();
  const body = $('#specialOffersManualVerificationBody', modal);
  if (body) body.innerHTML = renderManualVerificationBody();
  modal.hidden = false;
}

async function refreshManualVerification() {
  const modal = ensureManualVerificationModal();
  const body = $('#specialOffersManualVerificationBody', modal);
  specialOffersState.manualVerification.postsLoading = true;
  specialOffersState.manualVerification.postsError = '';
  specialOffersState.manualVerification.activities.loading = true;
  specialOffersState.manualVerification.activities.error = '';
  if (body) body.innerHTML = renderManualVerificationBody();
  try {
    const posts = await loadOfficialPosts(specialOffersState.manualVerification.offerId);
    const [postActivityCounts, counts, page] = await Promise.all([
      loadOfficialPostActivityCounts(posts),
      loadActivityCounts({
        offerId: specialOffersState.manualVerification.offerId,
        status: specialOffersState.manualVerification.activities.status,
        activityType: specialOffersState.manualVerification.activities.activityType,
        officialPostId: specialOffersState.manualVerification.activities.officialPostId,
        search: specialOffersState.manualVerification.activities.search,
      }),
      loadActivitiesPage(),
    ]);
    specialOffersState.manualVerification.posts = posts;
    specialOffersState.manualVerification.postActivityCounts = postActivityCounts;
    specialOffersState.manualVerification.counts = counts;
    specialOffersState.manualVerification.activities.rows = page.rows;
    specialOffersState.manualVerification.activities.entriesById = page.entriesById;
    specialOffersState.manualVerification.activities.postsById = page.postsById;
    specialOffersState.manualVerification.activities.total = page.total;
  } catch (_error) {
    specialOffersState.manualVerification.postsError = 'Unable to load manual verification data. Check admin access and Special Offers RLS.';
    specialOffersState.manualVerification.postActivityCounts = {};
    specialOffersState.manualVerification.activities.rows = [];
    specialOffersState.manualVerification.activities.total = 0;
    specialOffersState.manualVerification.activities.error = 'Unable to load activity queue.';
  } finally {
    specialOffersState.manualVerification.postsLoading = false;
    specialOffersState.manualVerification.activities.loading = false;
    if (body) body.innerHTML = renderManualVerificationBody();
  }
}

async function refreshActivityQueue() {
  const modal = ensureManualVerificationModal();
  const body = $('#specialOffersManualVerificationBody', modal);
  specialOffersState.manualVerification.activities.loading = true;
  specialOffersState.manualVerification.activities.error = '';
  if (body) body.innerHTML = renderManualVerificationBody();
  try {
    const [counts, page] = await Promise.all([
      loadActivityCounts({
        offerId: specialOffersState.manualVerification.offerId,
        status: specialOffersState.manualVerification.activities.status,
        activityType: specialOffersState.manualVerification.activities.activityType,
        officialPostId: specialOffersState.manualVerification.activities.officialPostId,
        search: specialOffersState.manualVerification.activities.search,
      }),
      loadActivitiesPage(),
    ]);
    specialOffersState.manualVerification.counts = counts;
    specialOffersState.manualVerification.activities.rows = page.rows;
    specialOffersState.manualVerification.activities.entriesById = page.entriesById;
    specialOffersState.manualVerification.activities.postsById = page.postsById;
    specialOffersState.manualVerification.activities.total = page.total;
  } catch (_error) {
    specialOffersState.manualVerification.activities.rows = [];
    specialOffersState.manualVerification.activities.total = 0;
    specialOffersState.manualVerification.activities.error = 'Unable to load activity queue.';
  } finally {
    specialOffersState.manualVerification.activities.loading = false;
    if (body) body.innerHTML = renderManualVerificationBody();
  }
}

async function openManualVerificationModal(offerId = 'all') {
  specialOffersState.manualVerification.offerId = offerId || 'all';
  specialOffersState.manualVerification.activities.page = 1;
  specialOffersState.manualVerification.postEditingId = '';
  renderManualVerificationModal();
  await refreshManualVerification();
}

async function submitOfficialPost(form) {
  if (specialOffersState.manualVerification.postSaving) return;
  const client = getSupabaseClient();
  if (!client) {
    notifySpecialOffers('Supabase client is not available.', 'error');
    return;
  }
  const formData = new FormData(form);
  const postId = specialOffersState.manualVerification.postEditingId === 'new' ? null : specialOffersState.manualVerification.postEditingId || null;
  const existingPost = postId ? toArray(specialOffersState.manualVerification.posts).find((post) => String(post.id) === String(postId)) : null;
  const offerId = String(formData.get('offer_id') || existingPost?.offer_id || specialOffersState.manualVerification.offerId || '').trim();
  const adminTitle = String(formData.get('admin_title') || '').trim();
  const officialUrl = String(formData.get('official_url') || '').trim();
  const publishedAt = fromLocalDateTimeInputValue(formData.get('published_at'));
  const commentDeadlineAt = fromLocalDateTimeInputValue(formData.get('comment_deadline_at'));
  if (!offerId || !adminTitle || !officialUrl || !publishedAt) {
    notifySpecialOffers('Campaign, title, URL and published date are required.', 'error');
    return;
  }
  if (!isValidOfficialPostUrl(officialUrl)) {
    notifySpecialOffers('Official post URL must be http:// or https://.', 'error');
    return;
  }
  if (commentDeadlineAt && new Date(commentDeadlineAt).getTime() < new Date(publishedAt).getTime()) {
    notifySpecialOffers('Comment deadline must be after publication time.', 'error');
    return;
  }
  specialOffersState.manualVerification.postSaving = true;
  renderManualVerificationModal();
  try {
    const result = await client.rpc('admin_upsert_special_offer_official_post', {
      p_post_id: postId,
      p_offer_id: offerId,
      p_post_order: Number(formData.get('post_order') || 0),
      p_week_number: formData.get('week_number') ? Number(formData.get('week_number')) : null,
      p_admin_title: adminTitle,
      p_platform: String(formData.get('platform') || 'facebook').trim().toLowerCase(),
      p_official_url: officialUrl,
      p_external_post_id: String(formData.get('external_post_id') || '').trim() || null,
      p_published_at: publishedAt,
      p_comment_deadline_at: commentDeadlineAt,
      p_active: true,
    });
    if (result.error) throw result.error;
    specialOffersState.manualVerification.postEditingId = '';
    notifySpecialOffers('Official post saved.', 'success');
    await refreshManualVerification();
  } catch (_error) {
    notifySpecialOffers('Official post could not be saved.', 'error');
  } finally {
    specialOffersState.manualVerification.postSaving = false;
    renderManualVerificationModal();
  }
}

async function deactivateOfficialPost(postId) {
  if (!postId) return;
  if (!window.confirm('Deactivate this official post? New claims will be blocked, but historic activities and points stay available.')) return;
  const client = getSupabaseClient();
  if (!client) {
    notifySpecialOffers('Supabase client is not available.', 'error');
    return;
  }
  try {
    const result = await client.rpc('admin_deactivate_special_offer_official_post', { p_post_id: postId });
    if (result.error) throw result.error;
    notifySpecialOffers(result.data?.[0]?.idempotent ? 'Official post was already inactive.' : 'Official post deactivated.', 'success');
    await refreshManualVerification();
  } catch (_error) {
    notifySpecialOffers('Official post could not be deactivated.', 'error');
  }
}

async function submitOfficialPostDelete(form) {
  if (specialOffersState.manualVerification.postDelete.deleting) return;
  const postId = specialOffersState.manualVerification.postDelete.postId;
  const post = toArray(specialOffersState.manualVerification.posts).find((row) => String(row.id) === String(postId));
  if (!post) return;
  const reason = String(form.querySelector('[name="delete_reason"]')?.value || '').trim();
  const expectedTitle = String(form.querySelector('[name="expected_admin_title"]')?.value || '').trim();
  const activityCount = Number(specialOffersState.manualVerification.postActivityCounts?.[postId] || 0);
  if (!reason) {
    specialOffersState.manualVerification.postDelete.error = 'Permanent delete requires a reason.';
    renderOfficialPostDeleteModal();
    return;
  }
  if (expectedTitle !== String(post.admin_title || '')) {
    specialOffersState.manualVerification.postDelete.error = 'Type the exact admin title before deleting.';
    renderOfficialPostDeleteModal();
    return;
  }
  if (post.active) {
    specialOffersState.manualVerification.postDelete.error = 'Deactivate the official post before deleting it.';
    renderOfficialPostDeleteModal();
    return;
  }
  if (activityCount > 0) {
    specialOffersState.manualVerification.postDelete.error = 'This post has participant activities. Delete or resolve linked test entries first.';
    renderOfficialPostDeleteModal();
    return;
  }
  if (!window.confirm(`Permanently delete official post "${post.admin_title}"? This cannot be undone.`)) return;
  const client = getSupabaseClient();
  if (!client) {
    specialOffersState.manualVerification.postDelete.error = 'Supabase client is not available.';
    renderOfficialPostDeleteModal();
    return;
  }
  specialOffersState.manualVerification.postDelete.deleting = true;
  specialOffersState.manualVerification.postDelete.error = '';
  renderOfficialPostDeleteModal();
  try {
    const result = await client.rpc('admin_delete_special_offer_official_post', {
      p_official_post_id: post.id,
      p_expected_admin_title: expectedTitle,
      p_reason: reason,
    });
    if (result.error) throw result.error;
    notifySpecialOffers(result.data?.[0]?.deleted === false ? 'Official post was already removed.' : 'Official post deleted permanently.', 'success');
    closeOfficialPostDeleteModal();
    await refreshManualVerification();
  } catch (error) {
    logSafeRpcError('Special Offers official post delete RPC failed', error);
    specialOffersState.manualVerification.postDelete.error = getSpecialOfferDeleteErrorMessage(error, 'Official post could not be deleted.');
  } finally {
    specialOffersState.manualVerification.postDelete.deleting = false;
    if (specialOffersState.manualVerification.postDelete.postId) {
      renderOfficialPostDeleteModal();
    }
  }
}

function renderEntryDetails() {
  const modal = ensureEntryDetailsModal();
  const body = $('#specialOfferEntryDetailsBody', modal);
  const detail = specialOffersState.entries.detail;
  if (!body) return;
  if (!detail?.entry) {
    body.innerHTML = '<div class="special-offer-entry-state">Loading entry details...</div>';
    return;
  }
  const entry = detail.entry;
  const campaign = getCampaignById(entry.offer_id);
  body.innerHTML = `
    <div class="special-offer-entry-detail-grid">
      <section class="special-offers-detail-panel">
        <h4>Entry</h4>
        ${renderDetailRows([
          ['Reference', entry.reference],
          ['Campaign', campaign ? formatCampaignTitle(campaign) : shortId(entry.offer_id)],
          ['Status', titleCase(entry.status)],
          ['Submitted at', formatDateTime(entry.created_at)],
          ['Corrected at', formatDateTime(entry.corrected_at)],
          ['Correction used', Number(entry.correction_count || 0) >= 1 ? 'Yes' : 'No'],
          ['Reviewed at', formatDateTime(entry.reviewed_at)],
          ['Reviewed by', shortId(entry.reviewed_by)],
          ['Language', String(entry.submitted_lang || '').toUpperCase()],
        ])}
      </section>
      <section class="special-offers-detail-panel">
        <h4>Participant</h4>
        ${renderDetailRows([
          ['Name', [entry.first_name, entry.last_name].filter(Boolean).join(' ') || 'Not provided'],
          ['Email', maskEmail(entry.normalized_email)],
          ['Phone', entry.phone ? 'Stored in details' : 'Not provided'],
          ['User ID', shortId(entry.user_id)],
        ])}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <div class="special-offer-entry-section-heading">
          <h4>Answers</h4>
          <button class="btn-secondary btn-small" type="button" data-special-offers-entry-full-form="${escapeHtml(entry.id)}">View full form</button>
        </div>
        ${renderEntryAnswers(detail.answers)}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Review notes</h4>
        ${renderDetailRows([
          ['Review note', entry.review_note || 'Not set'],
          ['Rejection reason', entry.rejection_reason || 'Not set'],
        ])}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Activity & Points</h4>
        ${renderScoreSummary(detail.score)}
        ${renderEntryActivities(detail)}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Winner selection</h4>
        ${renderEntryWinnerSelection(detail)}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Review actions</h4>
        ${renderReviewActions(entry)}
        ${renderReviewForm(specialOffersState.entries.reviewAction)}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide special-offers-danger-panel">
        <h4>Danger zone</h4>
        ${renderEntryDeletePanel(entry, detail)}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Audit trail</h4>
        ${renderEntryAuditLog(detail.auditLog)}
      </section>
    </div>
  `;
}

async function openEntryDetails(entryId) {
  if (!entryId) return;
  specialOffersState.entries.selectedEntryId = entryId;
  specialOffersState.entries.detail = null;
  specialOffersState.entries.reviewAction = '';
  const modal = ensureEntryDetailsModal();
  modal.hidden = false;
  renderEntryDetails();
  try {
    specialOffersState.entries.detail = await loadEntryDetail(entryId);
  } catch (error) {
    const body = $('#specialOfferEntryDetailsBody', modal);
    if (body) body.innerHTML = '<div class="special-offer-entry-state special-offer-entry-state--error">Unable to load entry details.</div>';
    return;
  }
  renderEntryDetails();
}

async function refreshSelectedEntryDetails() {
  const entryId = specialOffersState.entries.selectedEntryId;
  if (!entryId) return;
  specialOffersState.entries.detail = await loadEntryDetail(entryId);
  renderEntryDetails();
}

function updateReviewCharacterCounters() {
  const modal = $('#specialOfferEntryDetailsModal');
  if (!modal) return;
  const note = $('[data-special-offers-review-note]', modal);
  const reason = $('[data-special-offers-review-reason]', modal);
  const noteCount = $('[data-special-offers-review-note-count]', modal);
  const reasonCount = $('[data-special-offers-review-reason-count]', modal);
  if (noteCount) noteCount.textContent = String((note?.value || '').length);
  if (reasonCount) reasonCount.textContent = String((reason?.value || '').length);
}

async function submitEntryReview(form) {
  if (specialOffersState.entries.reviewing) return;
  const detail = specialOffersState.entries.detail;
  const entry = detail?.entry;
  const action = specialOffersState.entries.reviewAction;
  if (!entry || !action) return;
  const reviewNote = String(form.querySelector('[name="review_note"]')?.value || '');
  const rejectionReason = String(form.querySelector('[name="rejection_reason"]')?.value || '');
  const trimmedReason = rejectionReason.trim();
  if (reviewNote.length > 2000) {
    notifySpecialOffers('Review note is too long.', 'error');
    return;
  }
  if (rejectionReason.length > 1000) {
    notifySpecialOffers('Rejection reason is too long.', 'error');
    return;
  }
  if (['rejected', 'disqualified'].includes(action) && !trimmedReason) {
    notifySpecialOffers('Reject and disqualify require a reason.', 'error');
    return;
  }
  if (!window.confirm(`Confirm ${getReviewActionLabel(action)} for entry ${entry.reference || shortId(entry.id)}?`)) return;
  const client = getSupabaseClient();
  if (!client) {
    notifySpecialOffers('Supabase client is not available.', 'error');
    return;
  }
  specialOffersState.entries.reviewing = true;
  renderEntryDetails();
  try {
    const result = await client.rpc('review_special_offer_entry', {
      p_entry_id: entry.id,
      p_new_status: action,
      p_review_note: reviewNote || null,
      p_rejection_reason: rejectionReason || null,
    });
    if (result.error) throw result.error;
    notifySpecialOffers(result.data?.[0]?.idempotent ? 'Review state already applied.' : 'Entry review saved.', 'success');
    specialOffersState.entries.reviewAction = '';
    await refreshEntriesList();
    await refreshSelectedEntryDetails();
  } catch (error) {
    notifySpecialOffers('Entry review could not be saved.', 'error');
  } finally {
    specialOffersState.entries.reviewing = false;
    renderEntryDetails();
  }
}

async function submitEntryDelete(form) {
  if (specialOffersState.entries.deleting) return;
  const detail = specialOffersState.entries.detail;
  const entry = detail?.entry;
  if (!entry) return;
  const reason = String(form.querySelector('[name="delete_reason"]')?.value || '').trim();
  const expectedReference = String(form.querySelector('[name="expected_reference"]')?.value || '').trim();
  if (!reason) {
    notifySpecialOffers('Permanent delete requires a reason.', 'error');
    return;
  }
  if (expectedReference !== String(entry.reference || '')) {
    notifySpecialOffers('Type the exact entry reference before deleting.', 'error');
    return;
  }
  if (!window.confirm(`Permanently delete entry ${entry.reference || shortId(entry.id)} and its linked answers and activities? This cannot be undone.`)) return;
  const client = getSupabaseClient();
  if (!client) {
    notifySpecialOffers('Supabase client is not available.', 'error');
    return;
  }
  specialOffersState.entries.deleting = true;
  renderEntryDetails();
  try {
    const result = await client.rpc('admin_delete_special_offer_entry', {
      p_entry_id: entry.id,
      p_expected_reference: expectedReference,
      p_reason: reason,
    });
    if (result.error) throw result.error;
    notifySpecialOffers('Entry deleted permanently.', 'success');
    closeEntryFullForm();
    closeEntryDetails();
    await refreshEntriesList();
    if (!$('#specialOffersManualVerificationModal')?.hidden) {
      await refreshManualVerification();
    }
  } catch (error) {
    logSafeRpcError('Special Offers entry delete RPC failed', error);
    notifySpecialOffers(getSpecialOfferDeleteErrorMessage(error, 'Entry could not be deleted.'), 'error');
  } finally {
    specialOffersState.entries.deleting = false;
  }
}

function ensureActivityDetailModal() {
  let modal = $('#specialOfferActivityDetailModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-entry-detail-modal';
  modal.id = 'specialOfferActivityDetailModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-activity-detail-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOfferActivityDetailTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Activity review</div>
          <h3 id="specialOfferActivityDetailTitle">Activity details</h3>
          <p class="special-offer-editor-subtitle">Evidence is read-only. Review decisions go through review_special_offer_activity.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-activity-detail-close aria-label="Close activity details">×</button>
      </header>
      <div class="admin-modal-body" id="specialOfferActivityDetailBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-activity-detail-close]')) closeActivityDetail();
    const action = target?.closest('[data-special-offers-activity-review-action]');
    if (action) {
      specialOffersState.manualVerification.activities.reviewAction = action.getAttribute('data-special-offers-activity-review-action') || '';
      renderActivityDetail();
    }
    if (target?.closest('[data-special-offers-activity-review-cancel]')) {
      specialOffersState.manualVerification.activities.reviewAction = '';
      renderActivityDetail();
    }
  });
  modal.addEventListener('input', updateActivityReviewCharacterCounters);
  modal.addEventListener('submit', (event) => {
    const form = event.target instanceof Element ? event.target.closest('[data-special-offers-activity-review-form]') : null;
    if (!form) return;
    event.preventDefault();
    submitActivityReview(form);
  });
  return modal;
}

function closeActivityDetail() {
  const modal = $('#specialOfferActivityDetailModal');
  if (modal) modal.hidden = true;
  specialOffersState.manualVerification.activities.selectedActivityId = null;
  specialOffersState.manualVerification.activities.detail = null;
  specialOffersState.manualVerification.activities.reviewAction = '';
}

function renderActivityDetail() {
  const modal = ensureActivityDetailModal();
  const body = $('#specialOfferActivityDetailBody', modal);
  const detail = specialOffersState.manualVerification.activities.detail;
  if (!body) return;
  if (!detail?.activity) {
    body.innerHTML = '<div class="special-offer-entry-state">Loading activity details...</div>';
    return;
  }
  const { activity, entry, post } = detail;
  body.innerHTML = `
    <div class="special-offer-entry-detail-grid">
      <section class="special-offers-detail-panel">
        <h4>Entry</h4>
        ${renderDetailRows([
          ['Reference', entry.reference],
          ['Entry status', titleCase(entry.status)],
          ['Participant', [entry.first_name, entry.last_name].filter(Boolean).join(' ') || maskEmail(entry.normalized_email)],
          ['Submitted at', formatDateTime(entry.created_at)],
        ])}
      </section>
      <section class="special-offers-detail-panel">
        <h4>Official post</h4>
        ${renderDetailRows([
          ['Title', post.admin_title],
          ['Order', post.post_order],
          ['Platform', titleCase(post.platform)],
          ['Published at', formatDateTime(post.published_at)],
          ['Comment deadline', formatDateTime(post.comment_deadline_at)],
          ['Active', post.active ? 'Yes' : 'No'],
        ])}
        <div class="special-offer-entry-answer">
          <strong>Official URL</strong>
          <p>${renderSafeExternalLink(post.official_url, post.official_url)}</p>
        </div>
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Evidence</h4>
        ${renderDetailRows([
          ['Activity type', titleCase(activity.activity_type)],
          ['Evidence text', activity.evidence_text || 'Not provided'],
          ['Participant reported at', formatDateTime(activity.participant_reported_at)],
          ['Verified activity at', formatDateTime(activity.verified_activity_at)],
          ['Status', titleCase(activity.status)],
          ['Points awarded', activity.points_awarded],
          ['Verified at', formatDateTime(activity.verified_at)],
          ['Verified by', shortId(activity.verified_by)],
          ['Review note', activity.review_note || 'Not set'],
          ['Rejection reason', activity.rejection_reason || 'Not set'],
        ])}
        <div class="special-offer-entry-answer">
          <strong>Evidence URL</strong>
          <p>${renderSafeExternalLink(activity.evidence_url, activity.evidence_url)}</p>
        </div>
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Current score</h4>
        ${renderScoreSummary(detail.score)}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Review actions</h4>
        ${renderActivityReviewActions(activity)}
        ${renderActivityReviewForm(specialOffersState.manualVerification.activities.reviewAction, detail)}
      </section>
      <section class="special-offers-detail-panel special-offers-detail-panel--wide">
        <h4>Audit trail</h4>
        ${renderActivityAuditLog(detail.auditLog)}
      </section>
    </div>
  `;
}

async function openActivityDetail(activityId) {
  if (!activityId) return;
  specialOffersState.manualVerification.activities.selectedActivityId = activityId;
  specialOffersState.manualVerification.activities.detail = null;
  specialOffersState.manualVerification.activities.reviewAction = '';
  const modal = ensureActivityDetailModal();
  modal.hidden = false;
  renderActivityDetail();
  try {
    specialOffersState.manualVerification.activities.detail = await loadActivityDetail(activityId);
  } catch (_error) {
    const body = $('#specialOfferActivityDetailBody', modal);
    if (body) body.innerHTML = '<div class="special-offer-entry-state special-offer-entry-state--error">Unable to load activity details.</div>';
    return;
  }
  renderActivityDetail();
}

async function refreshSelectedActivityDetail() {
  const activityId = specialOffersState.manualVerification.activities.selectedActivityId;
  if (!activityId) return;
  specialOffersState.manualVerification.activities.detail = await loadActivityDetail(activityId);
  renderActivityDetail();
}

function updateActivityReviewCharacterCounters() {
  const modal = $('#specialOfferActivityDetailModal');
  if (!modal) return;
  const note = $('[data-special-offers-activity-review-note]', modal);
  const reason = $('[data-special-offers-activity-review-reason]', modal);
  const noteCount = $('[data-special-offers-activity-review-note-count]', modal);
  const reasonCount = $('[data-special-offers-activity-review-reason-count]', modal);
  if (noteCount) noteCount.textContent = String((note?.value || '').length);
  if (reasonCount) reasonCount.textContent = String((reason?.value || '').length);
}

async function submitActivityReview(form) {
  if (specialOffersState.manualVerification.activities.reviewing) return;
  const detail = specialOffersState.manualVerification.activities.detail;
  const activity = detail?.activity;
  const post = detail?.post;
  const action = specialOffersState.manualVerification.activities.reviewAction;
  if (!activity || !post || !action) return;
  const reviewNote = String(form.querySelector('[name="review_note"]')?.value || '');
  const rejectionReason = String(form.querySelector('[name="rejection_reason"]')?.value || '');
  const verifiedActivityAt = fromLocalDateTimeInputValue(form.querySelector('[name="verified_activity_at"]')?.value || '');
  if (reviewNote.length > 2000) {
    notifySpecialOffers('Review note is too long.', 'error');
    return;
  }
  if (rejectionReason.length > 1000) {
    notifySpecialOffers('Rejection reason is too long.', 'error');
    return;
  }
  if (['rejected', 'invalid'].includes(action) && !rejectionReason.trim()) {
    notifySpecialOffers('Reject and invalid decisions require a reason.', 'error');
    return;
  }
  if (activity.activity_type === 'comment' && action === 'approved') {
    if (!verifiedActivityAt) {
      notifySpecialOffers('Comment approval requires verified activity time.', 'error');
      return;
    }
    const verifiedTime = new Date(verifiedActivityAt).getTime();
    const publishedTime = new Date(post.published_at).getTime();
    const deadlineTime = new Date(post.comment_deadline_at).getTime();
    if (Number.isFinite(publishedTime) && verifiedTime < publishedTime) {
      notifySpecialOffers('Verified comment time cannot be before official post publication.', 'error');
      return;
    }
    if (Number.isFinite(deadlineTime) && verifiedTime > deadlineTime) {
      notifySpecialOffers('Verified comment time must be within the 24h comment window.', 'error');
      return;
    }
  }
  if (!window.confirm(`Confirm ${getActivityReviewActionLabel(action)} for this activity?`)) return;
  const client = getSupabaseClient();
  if (!client) {
    notifySpecialOffers('Supabase client is not available.', 'error');
    return;
  }
  specialOffersState.manualVerification.activities.reviewing = true;
  renderActivityDetail();
  try {
    const result = await client.rpc('review_special_offer_activity', {
      p_activity_id: activity.id,
      p_new_status: action,
      p_verified_activity_at: verifiedActivityAt,
      p_review_note: reviewNote || null,
      p_rejection_reason: rejectionReason || null,
    });
    if (result.error) throw result.error;
    notifySpecialOffers(result.data?.[0]?.idempotent ? 'Activity review state already applied.' : 'Activity review saved.', 'success');
    specialOffersState.manualVerification.activities.reviewAction = '';
    await refreshActivityQueue();
    await refreshSelectedActivityDetail();
    await refreshSelectedEntryDetails();
  } catch (_error) {
    notifySpecialOffers('Activity review could not be saved.', 'error');
  } finally {
    specialOffersState.manualVerification.activities.reviewing = false;
    renderActivityDetail();
  }
}

function ensureManualWinnerModal() {
  let modal = $('#specialOffersManualWinnerModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-manual-winner-modal';
  modal.id = 'specialOffersManualWinnerModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-winner-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOffersManualWinnerTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Manual winner selection</div>
          <h3 id="specialOffersManualWinnerTitle">Manual Winner Selection</h3>
          <p class="special-offer-editor-subtitle">Admin-only workflow. Writes use manual winner RPCs only.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-winner-close aria-label="Close manual winner selection">×</button>
      </header>
      <div class="admin-modal-body" id="specialOffersManualWinnerBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-winner-close]')) closeManualWinnerModal();
    if (target?.closest('[data-special-offers-winner-refresh]')) refreshManualWinner();
    const addShortlist = target?.closest('[data-special-offers-winner-add-shortlist]');
    if (addShortlist && !addShortlist.disabled) addWinnerShortlistEntry(addShortlist.getAttribute('data-special-offers-winner-add-shortlist') || '');
    const viewActivities = target?.closest('[data-special-offers-winner-view-activities]');
    if (viewActivities) openEntryDetails(viewActivities.getAttribute('data-special-offers-winner-view-activities') || '');
    const fullForm = target?.closest('[data-special-offers-entry-full-form]');
    if (fullForm) openEntryFullForm(fullForm.getAttribute('data-special-offers-entry-full-form') || '');
    const activityDetail = target?.closest('[data-special-offers-activity-detail]');
    if (activityDetail) openActivityDetail(activityDetail.getAttribute('data-special-offers-activity-detail') || '');
    const action = target?.closest('[data-special-offers-winner-action]');
    if (action && !action.disabled) {
      specialOffersState.manualWinner.action = {
        type: action.getAttribute('data-special-offers-winner-action') || '',
        targetId: action.getAttribute('data-winner-action-target') || '',
        submitting: false,
        error: '',
      };
      if (['recheck'].includes(specialOffersState.manualWinner.action.type)) {
        submitManualWinnerAction();
        return;
      }
      renderManualWinnerModal();
    }
    if (target?.closest('[data-special-offers-winner-action-cancel]')) {
      resetManualWinnerAction();
      renderManualWinnerModal();
    }
  });
  modal.addEventListener('change', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const offer = target?.closest('[data-special-offers-winner-offer]');
    if (!offer) return;
    specialOffersState.manualWinner.offerId = offer.value || specialOffersState.campaigns[0]?.id || 'all';
    resetManualWinnerAction();
    refreshManualWinner();
  });
  modal.addEventListener('submit', (event) => {
    const form = event.target instanceof Element ? event.target.closest('[data-special-offers-winner-action-form]') : null;
    if (!form) return;
    event.preventDefault();
    submitManualWinnerAction(form);
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeManualWinnerModal();
      return;
    }
    trapFocusWithin($('.admin-modal-content', modal), event);
  });
  return modal;
}

function closeManualWinnerModal() {
  const modal = $('#specialOffersManualWinnerModal');
  if (modal) modal.hidden = true;
  resetManualWinnerAction();
  const trigger = specialOffersState.manualWinner.lastTrigger;
  specialOffersState.manualWinner.lastTrigger = null;
  if (trigger && typeof trigger.focus === 'function') {
    try {
      trigger.focus();
    } catch (_error) {
      // ignore focus restoration failures
    }
  }
}

function resetManualWinnerAction() {
  specialOffersState.manualWinner.action = {
    type: '',
    targetId: '',
    submitting: false,
    error: '',
  };
}

function renderManualWinnerModal() {
  const modal = ensureManualWinnerModal();
  const body = $('#specialOffersManualWinnerBody', modal);
  if (body) body.innerHTML = renderManualWinnerBody();
  modal.hidden = false;
  if (!modal.contains(document.activeElement)) {
    const closeButton = $('[data-special-offers-winner-close]', modal);
    if (closeButton && typeof closeButton.focus === 'function') closeButton.focus();
  }
}

async function refreshManualWinner() {
  const modal = ensureManualWinnerModal();
  const body = $('#specialOffersManualWinnerBody', modal);
  specialOffersState.manualWinner.loading = true;
  specialOffersState.manualWinner.error = '';
  specialOffersState.manualWinner.errorMeta = null;
  if (body) body.innerHTML = renderManualWinnerBody();
  try {
    const data = await loadManualWinnerData(specialOffersState.manualWinner.offerId);
    Object.assign(specialOffersState.manualWinner, data);
  } catch (error) {
    logSafeRpcError('Special Offers manual winner load failed', error);
    specialOffersState.manualWinner.error = 'Unable to load Manual Winner Selection.';
    specialOffersState.manualWinner.errorMeta = getManualWinnerErrorMeta(error);
  } finally {
    specialOffersState.manualWinner.loading = false;
    if (body) body.innerHTML = renderManualWinnerBody();
  }
}

async function openManualWinnerModal(offerId = 'all', trigger = null) {
  const fallbackOfferId = specialOffersState.campaigns[0]?.id || 'all';
  specialOffersState.manualWinner.offerId = offerId && offerId !== 'all' ? offerId : fallbackOfferId;
  specialOffersState.manualWinner.lastTrigger = trigger || document.activeElement || null;
  resetManualWinnerAction();
  renderManualWinnerModal();
  await refreshManualWinner();
}

function getManualWinnerErrorMessage(error, fallback = 'Manual winner action could not be completed.') {
  switch (getRpcErrorKey(error)) {
    case 'admin_required':
    case 'login_required':
      return 'Admin access is required for this action.';
    case 'winner_workflow_not_ready':
      return 'Workflow readiness blocks this action.';
    case 'workflow_reason_required':
    case 'candidate_reason_required':
    case 'remove_reason_required':
    case 'promote_reason_required':
    case 'confirm_reason_required':
    case 'publish_reason_required':
    case 'unpublish_reason_required':
      return 'A reason is required.';
    case 'entry_not_approved':
      return 'Only approved entries can be shortlisted.';
    case 'shortlist_needs_recheck':
      return 'This shortlist item needs recheck before role assignment.';
    case 'backup_rank_required':
      return 'Backup rank must be greater than 0.';
    case 'contact_deadline_required':
      return 'Response deadline must be in the future.';
    case 'winner_response_status_invalid':
      return 'Choose accepted, declined or no response.';
    case 'winner_contact_not_accepted':
      return 'Winner confirmation requires accepted manual contact.';
    case 'publication_consent_required':
      return 'Publication requires confirmed consent.';
    case 'public_name_required':
      return 'Public name is required.';
    default:
      return fallback;
  }
}

async function addWinnerShortlistEntry(entryId) {
  const workflow = specialOffersState.manualWinner.activeWorkflow;
  if (!workflow?.id || !entryId) return;
  const client = getSupabaseClient();
  if (!client) {
    notifySpecialOffers('Supabase client is not available.', 'error');
    return;
  }
  try {
    const result = await client.rpc('admin_add_special_offer_shortlist_entry', {
      p_workflow_id: workflow.id,
      p_entry_id: entryId,
    });
    if (result.error) throw result.error;
    notifySpecialOffers('Entry added to shortlist.', 'success');
    await refreshManualWinner();
  } catch (error) {
    logSafeRpcError('Special Offers shortlist add RPC failed', error);
    notifySpecialOffers(getManualWinnerErrorMessage(error, 'Entry could not be added to shortlist.'), 'error');
  }
}

function getManualWinnerActionReason(form, maxLength = 2000) {
  const reason = String(form?.querySelector('[name="reason"]')?.value || '').trim();
  if (!reason) throw new Error('reason_required');
  if (reason.length > maxLength) throw new Error('reason_too_long');
  return reason;
}

async function submitManualWinnerAction(form = null) {
  const state = specialOffersState.manualWinner;
  if (state.action.submitting) return;
  const client = getSupabaseClient();
  if (!client) {
    notifySpecialOffers('Supabase client is not available.', 'error');
    return;
  }
  const action = state.action.type;
  const targetId = state.action.targetId;
  let rpcName = '';
  let params = {};
  let confirmMessage = 'Confirm this manual winner action?';
  try {
    if (action === 'start') {
      const reason = getManualWinnerActionReason(form);
      rpcName = 'admin_start_special_offer_winner_workflow';
      params = { p_offer_id: state.offerId, p_reason: reason };
      confirmMessage = 'Start manual winner selection? This is not a draw and points do not select the winner automatically.';
    } else if (action === 'recheck') {
      rpcName = 'admin_mark_special_offer_shortlist_rechecked';
      params = { p_shortlist_id: targetId };
      confirmMessage = 'Mark this shortlist item as rechecked? Roles will not be restored automatically.';
    } else if (action === 'primary') {
      const reason = getManualWinnerActionReason(form);
      rpcName = 'admin_set_special_offer_primary_candidate';
      params = { p_shortlist_id: targetId, p_reason: reason };
      confirmMessage = 'Set this entry as the primary candidate?';
    } else if (action === 'backup') {
      const reason = getManualWinnerActionReason(form);
      const backupRank = Number(form?.querySelector('[name="backup_rank"]')?.value || 0);
      if (!Number.isInteger(backupRank) || backupRank <= 0) throw new Error('backup_rank_required');
      rpcName = 'admin_set_special_offer_backup_candidate';
      params = { p_shortlist_id: targetId, p_backup_rank: backupRank, p_reason: reason };
      confirmMessage = `Set this entry as backup #${backupRank}?`;
    } else if (action === 'remove') {
      const reason = getManualWinnerActionReason(form, 1000);
      rpcName = 'admin_remove_special_offer_shortlist_entry';
      params = { p_shortlist_id: targetId, p_reason: reason };
      confirmMessage = 'Remove this entry from shortlist? History remains in audit.';
    } else if (action === 'contact') {
      const responseDeadlineAt = fromLocalDateTimeInputValue(form?.querySelector('[name="response_deadline_at"]')?.value || '');
      const noteText = String(form?.querySelector('[name="note_text"]')?.value || '');
      if (!responseDeadlineAt) throw new Error('contact_deadline_required');
      if (noteText.length > 2000) throw new Error('note_too_long');
      rpcName = 'admin_start_special_offer_winner_contact';
      params = { p_shortlist_id: targetId, p_response_deadline_at: responseDeadlineAt, p_note_text: noteText || null };
      confirmMessage = 'Record manual contact start? No message will be sent.';
    } else if (action === 'response') {
      const status = String(form?.querySelector('[name="response_status"]')?.value || '').trim();
      const noteText = String(form?.querySelector('[name="note_text"]')?.value || '');
      if (!['accepted', 'declined', 'no_response'].includes(status)) throw new Error('winner_response_status_invalid');
      if (noteText.length > 2000) throw new Error('note_too_long');
      rpcName = 'admin_record_special_offer_winner_response';
      params = { p_contact_event_id: targetId, p_response_status: status, p_note_text: noteText || null };
      confirmMessage = `Record manual contact result as ${titleCase(status)}?`;
    } else if (action === 'promote') {
      const reason = getManualWinnerActionReason(form);
      rpcName = 'admin_promote_special_offer_backup';
      params = { p_backup_shortlist_id: targetId, p_reason: reason };
      confirmMessage = 'Promote this backup manually?';
    } else if (action === 'confirm') {
      const reason = getManualWinnerActionReason(form);
      rpcName = 'admin_confirm_special_offer_winner';
      params = { p_contact_event_id: targetId, p_reason: reason };
      confirmMessage = 'Confirm this accepted candidate as winner? Publication is a separate step.';
    } else if (action === 'publish') {
      const publicName = String(form?.querySelector('[name="public_name"]')?.value || '').trim();
      const consent = Boolean(form?.querySelector('[name="publication_consent_confirmed"]')?.checked);
      const reason = getManualWinnerActionReason(form, 1000);
      if (!publicName || publicName.length > 160) throw new Error('public_name_required');
      if (!consent) throw new Error('publication_consent_required');
      rpcName = 'admin_publish_special_offer_winner';
      params = { p_workflow_id: targetId, p_public_name: publicName, p_publication_consent_confirmed: true, p_reason: reason };
      confirmMessage = 'Publish this winner name? Confirm only after consent is documented.';
    } else if (action === 'unpublish') {
      const reason = getManualWinnerActionReason(form, 1000);
      rpcName = 'admin_unpublish_special_offer_winner';
      params = { p_publication_id: targetId, p_reason: reason };
      confirmMessage = 'Unpublish this winner result?';
    } else {
      return;
    }
  } catch (error) {
    state.action.error = getManualWinnerErrorMessage(error, error?.message === 'reason_required' ? 'A reason is required.' : 'Check the required fields.');
    renderManualWinnerModal();
    return;
  }
  if (!window.confirm(confirmMessage)) return;
  state.action.submitting = true;
  state.action.error = '';
  renderManualWinnerModal();
  try {
    const result = await client.rpc(rpcName, params);
    if (result.error) throw result.error;
    notifySpecialOffers('Manual winner action saved.', 'success');
    resetManualWinnerAction();
    await refreshManualWinner();
    await refreshSelectedEntryDetails();
  } catch (error) {
    logSafeRpcError(`Special Offers ${rpcName} RPC failed`, error);
    state.action.error = getManualWinnerErrorMessage(error);
    state.action.submitting = false;
    renderManualWinnerModal();
  }
}

function ensurePreviewModal() {
  let modal = $('#specialOffersPreviewModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-preview-modal';
  modal.id = 'specialOffersPreviewModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-preview-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOffersPreviewTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Admin-only preview</div>
          <h3 id="specialOffersPreviewTitle">Preview campaign</h3>
          <p class="special-offer-editor-subtitle">No public URL, no entry form, no draw.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-preview-close aria-label="Close preview">×</button>
      </header>
      <div class="admin-modal-body" id="specialOffersPreviewBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-preview-close]')) closeCampaignPreview();
    const langButton = target?.closest('[data-special-offers-preview-lang-tab]');
    if (langButton) activatePreviewLanguage(langButton);
  });
  return modal;
}

function ensureFormPreviewModal() {
  let modal = $('#specialOffersFormPreviewModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'admin-modal special-offers-preview-modal';
  modal.id = 'specialOffersFormPreviewModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-special-offers-form-preview-close></div>
    <div class="admin-modal-content special-offers-details-modal__content" role="dialog" aria-modal="true" aria-labelledby="specialOffersFormPreviewTitle">
      <header class="admin-modal-header">
        <div>
          <div class="special-offers-eyebrow">Admin-only preview</div>
          <h3 id="specialOffersFormPreviewTitle">Preview form</h3>
          <p class="special-offer-editor-subtitle">Current unsaved editor state. No public submit, no entries.</p>
        </div>
        <button class="btn-modal-close" type="button" data-special-offers-form-preview-close aria-label="Close form preview">×</button>
      </header>
      <div class="admin-modal-body" id="specialOffersFormPreviewBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-special-offers-form-preview-close]')) closeFormPreview();
    const langButton = target?.closest('[data-special-offers-form-preview-modal-lang]');
    if (langButton) {
      renderFormPreviewModal(langButton.getAttribute('data-special-offers-form-preview-modal-lang') || 'pl');
    }
  });
  return modal;
}

function buildPreviewCampaignFromPayload(payload) {
  return {
    ...payload.offer,
    id: specialOffersState.editingCampaignId || 'preview',
    translations: payload.translations,
    prizes: payload.prizes.map((prize, index) => ({ ...prize, id: prize.id || `preview-prize-${index}` })),
    links: payload.links.map((link, index) => ({ ...link, id: link.id || `preview-link-${index}` })),
    form_fields: payload.formFields.map((field, index) => ({ ...field, id: field.id || `preview-field-${index}` })),
  };
}

function renderPreviewPanel(campaign, language, isActive) {
  const translation = getTranslationByLanguage(campaign, language.code) || {};
  const prizes = toArray(campaign.prizes);
  const links = toArray(campaign.links);
  const formFields = toArray(campaign.form_fields);
  return `
    <section
      class="special-offers-preview-panel"
      data-special-offers-preview-lang-panel="${escapeHtml(language.code)}"
      dir="${escapeHtml(language.dir)}"
      ${isActive ? '' : 'hidden'}
    >
      <div class="special-offers-preview-hero">
        <span>${escapeHtml(titleCase(campaign.status))} / ${escapeHtml(titleCase(campaign.visibility))}</span>
        <h4>${escapeHtml(translation.title || campaign.slug || 'Untitled campaign')}</h4>
        <p>${escapeHtml(translation.short_description || 'No short description yet')}</p>
      </div>
      <div class="special-offers-preview-section">
        <h5>Full description</h5>
        <p>${escapeHtml(translation.full_description || 'Not set')}</p>
      </div>
      <div class="special-offers-preview-section">
        <h5>Prize</h5>
        ${prizes.length ? prizes.map((prize, index) => {
          const row = getPrizeTranslation(prize, language.code);
          return `
            <article class="special-offers-faq-item">
              <h5>${escapeHtml(row.name || prize.name || `Prize ${index + 1}`)}</h5>
              <p>${escapeHtml(row.description || prize.description || 'No prize description yet')}</p>
              ${row.restrictions ? `<p><strong>Restrictions:</strong> ${escapeHtml(row.restrictions)}</p>` : ''}
              ${row.fulfillment_notes ? `<p><strong>Fulfillment:</strong> ${escapeHtml(row.fulfillment_notes)}</p>` : ''}
            </article>
          `;
        }).join('') : '<p class="special-offers-empty-copy">No prizes configured.</p>'}
      </div>
      <div class="special-offers-preview-section">
        <h5>Rules</h5>
        ${renderRulesHtml(translation.rules_html)}
      </div>
      <div class="special-offers-preview-section">
        <h5>FAQ</h5>
        ${renderFaqItems(translation.faq_json)}
      </div>
      <div class="special-offers-preview-section">
        <h5>Linked services</h5>
        ${links.length ? `
          <div class="special-offers-preview-cta-list">
            ${links.map((link) => {
              const row = getLinkTranslation(link, language.code);
              return `<a class="btn-secondary btn-small" href="${escapeHtml(row.url || link.url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.label || link.label || titleCase(link.link_type))}</a>`;
            }).join('')}
          </div>
        ` : '<p class="special-offers-empty-copy">No linked services configured.</p>'}
      </div>
      <div class="special-offers-preview-section">
        <h5>Entry form preview</h5>
        ${renderFormPreviewFields(formFields, language.code)}
      </div>
      <div class="special-offers-preview-section">
        <h5>Campaign dates</h5>
        ${renderDetailRows([
          ['Start', formatDate(campaign.start_at)],
          ['End', formatDate(campaign.end_at)],
          ['Winner announce', formatDate(campaign.winner_announce_at)],
          ['Timezone', campaign.timezone],
        ])}
      </div>
      <p class="special-offer-editor-muted">Form submit, entries, draw and winners are not available in this preview.</p>
    </section>
  `;
}

function renderFormPreviewFields(fields, lang) {
  const language = SPECIAL_OFFERS_DETAIL_LANGUAGES.find((item) => item.code === lang) || SPECIAL_OFFERS_DETAIL_LANGUAGES[0];
  const activeFields = toArray(fields)
    .filter((field) => field.active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  if (!activeFields.length) return '<p class="special-offers-empty-copy">No active form fields configured.</p>';
  return `
    <div class="special-offer-form-preview-fields" role="group" dir="${escapeHtml(language.dir)}">
      ${activeFields.map((field) => renderFormPreviewField(field, language)).join('')}
      <button class="btn-primary btn-small" type="button" disabled>Preview only. Public submit is not available yet.</button>
    </div>
  `;
}

function renderFormPreviewField(field, language) {
  const translation = getFormFieldTranslation(field, language.code);
  const label = translation.label || titleCase(field.field_key);
  const required = field.required ? ' *' : '';
  const placeholder = translation.placeholder || '';
  const helpText = translation.help_text || '';
  const type = String(field.field_type || 'text');
  const dir = language.dir;
  const options = normalizeFormOptions(translation.options_json);
  const common = `aria-label="${escapeHtml(label)}" ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''} dir="${escapeHtml(dir)}" disabled`;
  let control = '';
  if (type === 'textarea' || type === 'contest_answer') {
    control = `<textarea rows="3" ${common}></textarea>`;
  } else if (type === 'select' || type === 'country' || type === 'city') {
    control = `
      <select ${common}>
        <option>${escapeHtml(placeholder || 'Select...')}</option>
        ${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
      </select>
    `;
  } else if (type === 'checkbox_group') {
    control = options.length
      ? `<div class="special-offer-form-preview-options">${options.map((option) => `<label class="special-offer-editor-check"><input type="checkbox" disabled /> ${escapeHtml(option.label)}</label>`).join('')}</div>`
      : '<p class="special-offers-empty-copy">No options yet</p>';
  } else if (type === 'checkbox' || type === 'consent') {
    control = `<label class="special-offer-editor-check"><input type="checkbox" disabled /> ${escapeHtml(label)}${field.required ? ' *' : ''}</label>`;
  } else {
    const inputType = type === 'email' ? 'email' : type === 'phone' ? 'tel' : type === 'date' || type === 'date_of_birth' ? 'date' : type.includes('url') ? 'url' : 'text';
    control = `<input type="${escapeHtml(inputType)}" ${common} />`;
  }
  return `
    <label class="special-offer-form-preview-field">
      ${type === 'checkbox' || type === 'consent' ? '' : `<span>${escapeHtml(label)}${required}</span>`}
      ${control}
      ${helpText ? `<small>${escapeHtml(helpText)}</small>` : ''}
    </label>
  `;
}

function renderCampaignPreview(campaign) {
  return `
    <div class="special-offers-translation-tabs" role="tablist" aria-label="Preview languages">
      ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => `
        <button class="special-offers-translation-tab${index === 0 ? ' is-active' : ''}" type="button" data-special-offers-preview-lang-tab="${escapeHtml(language.code)}">${escapeHtml(language.label)}</button>
      `).join('')}
    </div>
    ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language, index) => renderPreviewPanel(campaign, language, index === 0)).join('')}
  `;
}

function renderFormPreviewModal(lang = 'pl') {
  const modal = ensureFormPreviewModal();
  const body = $('#specialOffersFormPreviewBody', modal);
  if (!body) return;
  let payload = null;
  try {
    payload = collectEditorPayload();
  } catch (error) {
    body.innerHTML = `<p class="special-offer-editor-validation">${escapeHtml(error.message || 'Fix form errors before preview.')}</p>`;
    modal.hidden = false;
    return;
  }
  body.innerHTML = `
    <div class="special-offers-translation-tabs special-offers-translation-tabs--compact" role="tablist" aria-label="Form preview languages">
      ${SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language) => `
        <button class="special-offers-translation-tab${language.code === lang ? ' is-active' : ''}" type="button" data-special-offers-form-preview-modal-lang="${escapeHtml(language.code)}">${escapeHtml(language.label)}</button>
      `).join('')}
    </div>
    ${renderFormPreviewFields(payload.formFields, lang)}
  `;
  modal.hidden = false;
}

function closeFormPreview() {
  const modal = $('#specialOffersFormPreviewModal');
  if (modal) modal.hidden = true;
}

function renderPublicLandingPreviewLinks(campaign) {
  const rows = SPECIAL_OFFERS_DETAIL_LANGUAGES.map((language) => ({
    lang: language.code,
    publicUrl: buildSpecialOfferCleanPublicUrl(campaign, language.code),
    previewUrl: buildSpecialOfferPreviewUrl(campaign, language.code),
  }));
  return `
    <div class="special-offer-public-url-list">
      <p class="special-offer-editor-muted">Public links use the clean production URL. Admin preview uses <code>admin_preview=1</code> and keeps entry submission disabled.</p>
      ${rows.map((row) => `
        <div class="special-offer-public-url-row">
          <strong>${escapeHtml(row.lang.toUpperCase())}</strong>
          <a href="${escapeHtml(row.publicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.publicUrl)}</a>
          <button class="btn-secondary btn-small" type="button" data-special-offers-copy-raw-url="${escapeHtml(row.publicUrl)}">Copy public URL</button>
          <span>Admin preview: ${escapeHtml(row.previewUrl)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function openCampaignPreview(campaign = null) {
  let previewCampaign = campaign;
  if (!previewCampaign) {
    try {
      previewCampaign = buildPreviewCampaignFromPayload(collectEditorPayload());
    } catch (error) {
      setEditorMessage(error.message || 'Fix validation errors before preview.', 'error');
      return;
    }
  }
  const modal = ensurePreviewModal();
  const body = $('#specialOffersPreviewBody', modal);
  if (body) body.innerHTML = renderCampaignPreview(previewCampaign);
  modal.hidden = false;
}

function closeCampaignPreview() {
  const modal = $('#specialOffersPreviewModal');
  if (modal) modal.hidden = true;
}

function activatePreviewLanguage(button) {
  const modal = $('#specialOffersPreviewModal');
  const lang = button.getAttribute('data-special-offers-preview-lang-tab');
  if (!modal || !lang) return;
  $$('[data-special-offers-preview-lang-tab]', modal).forEach((tab) => {
    tab.classList.toggle('is-active', tab === button);
  });
  $$('[data-special-offers-preview-lang-panel]', modal).forEach((panel) => {
    panel.hidden = panel.getAttribute('data-special-offers-preview-lang-panel') !== lang;
  });
}

function refreshBuilderPreviews(root = document) {
  let previewCollectionsSynced = false;
  let previewCollectionsFailed = false;
  const syncCollectionsForPreview = () => {
    if (previewCollectionsSynced) return true;
    if (previewCollectionsFailed) return false;
    try {
      syncEditorCollectionsFromDom();
      previewCollectionsSynced = true;
      return true;
    } catch (_error) {
      previewCollectionsFailed = true;
      return false;
    }
  };

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
    const id = item?.getAttribute('data-special-offers-link');
    const link = specialOffersState.editorLinks.find((entry) => entry.client_id === id);
    if (link) {
      if (!syncCollectionsForPreview()) return;
      node.innerHTML = renderLinkUrlPreview(link);
    }
  });
  $$('[data-link-image-preview]', root).forEach((node) => {
    const item = node.closest('[data-special-offers-link]');
    const id = item?.getAttribute('data-special-offers-link');
    const link = specialOffersState.editorLinks.find((entry) => entry.client_id === id);
    if (link) {
      if (!syncCollectionsForPreview()) return;
      node.classList.remove('is-unavailable');
      node.innerHTML = renderLinkImagePreview(link);
    }
  });
  $$('[data-form-options-json-preview]', root).forEach((node) => {
    const key = node.getAttribute('data-form-options-json-preview');
    if (key) node.textContent = JSON.stringify(collectFormOptions(key), null, 2);
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

function addFormOption(key) {
  const list = document.querySelector(`[data-form-options-list="${key}"]`);
  if (!list) return;
  const [, lang = 'pl'] = String(key || '').split(':');
  const dir = SPECIAL_OFFERS_DETAIL_LANGUAGES.find((item) => item.code === lang)?.dir || 'ltr';
  if (list.querySelector('.special-offers-empty-copy')) list.innerHTML = '';
  list.insertAdjacentHTML('beforeend', renderOptionEditorItem({}, list.querySelectorAll('[data-form-option]').length, dir));
  refreshBuilderPreviews();
  validateEditorForm();
}

function deactivateOrRemoveFormField(clientId) {
  syncEditorCollectionsFromDom();
  const field = specialOffersState.editorFormFields.find((item) => item.client_id === clientId);
  if (!field) return;
  if (!window.confirm(field.id ? 'Deactivate this form field? It will not be hard deleted.' : 'Remove this unsaved form field?')) return;
  if (field.id) {
    field.active = false;
  } else {
    specialOffersState.editorFormFields = specialOffersState.editorFormFields.filter((item) => item.client_id !== clientId);
  }
  renderFormFieldEditorList();
  validateEditorForm();
}

function refreshFormFieldEditorItem(clientId) {
  syncEditorCollectionsFromDom();
  renderFormFieldEditorList();
  validateEditorForm();
}

function syncRequiresFormInputs(source) {
  const checked = Boolean(source?.checked);
  const form = $('#specialOfferEditorForm');
  if (!form) return;
  $$('[name="requires_form"], [data-offer-setting="requires_form"]', form).forEach((input) => {
    if (input !== source) input.checked = checked;
  });
}

async function copyTextToClipboard(text, button = null) {
  const value = String(text || '').trim();
  if (!value) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    if (button) {
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = original; }, 1400);
    }
  } catch (error) {
    console.error('Failed to copy Special Offer preview URL:', error);
    if (button) {
      const original = button.textContent;
      button.textContent = 'Copy failed';
      setTimeout(() => { button.textContent = original; }, 1800);
    }
  }
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
      const entriesButton = target?.closest('[data-special-offers-open-entries]');
      const manualVerificationButton = target?.closest('[data-special-offers-open-manual-verification]');
      const manualWinnerButton = target?.closest('[data-special-offers-open-manual-winner]');
      const copyPreviewButton = target?.closest('[data-special-offers-copy-preview-url]');
      if (viewButton) {
        openCampaignDetails(viewButton.getAttribute('data-special-offers-view'));
        return;
      }
      if (entriesButton) {
        openEntriesModal(entriesButton.getAttribute('data-special-offers-open-entries') || 'all');
        return;
      }
      if (manualVerificationButton) {
        openManualVerificationModal(manualVerificationButton.getAttribute('data-special-offers-open-manual-verification') || 'all');
        return;
      }
      if (manualWinnerButton && !manualWinnerButton.disabled) {
        openManualWinnerModal(manualWinnerButton.getAttribute('data-special-offers-open-manual-winner') || 'all', manualWinnerButton);
        return;
      }
      if (copyPreviewButton) {
        const campaign = specialOffersState.campaigns.find((item) => item.id === copyPreviewButton.getAttribute('data-special-offers-copy-preview-url'));
        if (campaign) copyTextToClipboard(buildSpecialOfferPreviewUrl(campaign, 'pl'), copyPreviewButton);
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
      const localLangButton = target?.closest('[data-special-offers-local-tab]');
      const editButton = target?.closest('[data-special-offers-edit]');
      const previewButton = target?.closest('[data-special-offers-preview]');
      const entriesButton = target?.closest('[data-special-offers-open-entries]');
      const manualVerificationButton = target?.closest('[data-special-offers-open-manual-verification]');
      const manualWinnerButton = target?.closest('[data-special-offers-open-manual-winner]');
      const copyRawUrlButton = target?.closest('[data-special-offers-copy-raw-url]');
      if (langButton) activateTranslationTab(langButton);
      if (localLangButton) activateLocalDetailLanguage(localLangButton);
      if (copyRawUrlButton) {
        copyTextToClipboard(copyRawUrlButton.getAttribute('data-special-offers-copy-raw-url'), copyRawUrlButton);
        return;
      }
      if (editButton && !editButton.disabled) {
        closeCampaignDetails();
        openCampaignEditor('edit', editButton.getAttribute('data-special-offers-edit'));
      }
      if (entriesButton) {
        openEntriesModal(entriesButton.getAttribute('data-special-offers-open-entries') || 'all');
      }
      if (manualVerificationButton) {
        openManualVerificationModal(manualVerificationButton.getAttribute('data-special-offers-open-manual-verification') || 'all');
      }
      if (manualWinnerButton && !manualWinnerButton.disabled) {
        openManualWinnerModal(manualWinnerButton.getAttribute('data-special-offers-open-manual-winner') || 'all', manualWinnerButton);
      }
      if (previewButton) {
        const campaign = specialOffersState.campaigns.find((item) => item.id === previewButton.getAttribute('data-special-offers-preview'));
        if (campaign) openCampaignPreview(campaign);
      }
    });
  }

  $$('[data-special-offers-create]').forEach((button) => {
    button.addEventListener('click', () => openCampaignEditor('create'));
  });

  $$('[data-special-offers-open-entries]').forEach((button) => {
    button.addEventListener('click', () => openEntriesModal(button.getAttribute('data-special-offers-open-entries') || 'all'));
  });

  $$('[data-special-offers-open-manual-verification]').forEach((button) => {
    button.addEventListener('click', () => openManualVerificationModal(button.getAttribute('data-special-offers-open-manual-verification') || 'all'));
  });

  $$('[data-special-offers-open-manual-winner]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!button.disabled) openManualWinnerModal(button.getAttribute('data-special-offers-open-manual-winner') || 'all', button);
    });
  });

  const editorBody = $('#specialOffersEditorBody');
  if (editorBody) {
    editorBody.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const sectionTab = target?.closest('[data-special-offers-editor-tab]');
      const langTab = target?.closest('[data-special-offers-editor-lang-tab]');
      const addPrizeButton = target?.closest('[data-special-offers-add-prize]');
      const addLinkButton = target?.closest('[data-special-offers-add-link]');
      const addFormFieldButton = target?.closest('[data-special-offers-add-form-field]');
      const removeFormFieldButton = target?.closest('[data-special-offers-remove-form-field]');
      const duplicateFormFieldButton = target?.closest('[data-special-offers-duplicate-form-field]');
      const addFormOptionButton = target?.closest('[data-special-offers-add-form-option]');
      const removeFormOptionButton = target?.closest('[data-special-offers-remove-form-option]');
      const previewFormButton = target?.closest('[data-special-offers-preview-form]');
      const helpButton = target?.closest('[data-special-offers-help]');
      const nestedLangButton = target?.closest('[data-special-offers-nested-lang-tab]');
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
      if (nestedLangButton) activateNestedLanguage(nestedLangButton);
      if (helpButton) openHelpPopover(helpButton.getAttribute('data-special-offers-help'));
      if (addPrizeButton) addEditorPrize();
      if (addLinkButton) addEditorLink();
      if (addFormFieldButton) addEditorFormField();
      if (duplicateFormFieldButton) duplicateEditorFormField(duplicateFormFieldButton.getAttribute('data-special-offers-duplicate-form-field'));
      if (removeFormFieldButton) deactivateOrRemoveFormField(removeFormFieldButton.getAttribute('data-special-offers-remove-form-field'));
      if (addFormOptionButton) addFormOption(addFormOptionButton.getAttribute('data-special-offers-add-form-option'));
      if (removeFormOptionButton) {
        removeFormOptionButton.closest('[data-form-option]')?.remove();
        refreshBuilderPreviews();
        validateEditorForm();
      }
      if (previewFormButton) renderFormPreviewModal();
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
      const clearLinkImageButton = target?.closest('[data-special-offers-clear-link-image]');
      if (clearLinkImageButton) {
        const id = clearLinkImageButton.getAttribute('data-special-offers-clear-link-image');
        const item = clearLinkImageButton.closest('[data-special-offers-link]');
        const input = item?.querySelector('[data-link-field="image_url"]');
        const link = specialOffersState.editorLinks.find((entry) => entry.client_id === id);
        if (input) input.value = '';
        if (link) link.image_url = '';
        refreshBuilderPreviews(editorBody);
        validateEditorForm();
      }
    });
    editorBody.addEventListener('input', () => {
      refreshBuilderPreviews(editorBody);
      validateEditorForm();
    });
    editorBody.addEventListener('change', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const linkField = target?.closest('[data-link-field]');
      const formField = target?.closest('[data-form-field]');
      const requiresFormInput = target?.closest('[name="requires_form"], [data-offer-setting="requires_form"]');
      if (requiresFormInput) syncRequiresFormInputs(requiresFormInput);
      if (linkField && ['link_type', 'mode', 'resource_id'].includes(linkField.getAttribute('data-link-field'))) {
        const item = linkField.closest('[data-special-offers-link]');
        const id = item?.getAttribute('data-special-offers-link');
        if (id) {
          refreshLinkEditorItem(id);
          return;
        }
      }
      if (formField && ['field_type'].includes(formField.getAttribute('data-form-field'))) {
        const item = formField.closest('[data-special-offers-form-field]');
        const id = item?.getAttribute('data-special-offers-form-field');
        if (id) {
          refreshFormFieldEditorItem(id);
          return;
        }
      }
      refreshBuilderPreviews(editorBody);
      validateEditorForm();
    });
  }

  const saveButton = $('#specialOffersEditorSave');
  if (saveButton) saveButton.addEventListener('click', () => saveCampaignFromEditor());

  const archiveButton = $('#specialOffersEditorArchive');
  if (archiveButton) archiveButton.addEventListener('click', () => archiveCurrentCampaign());

  const previewButton = $('#specialOffersEditorPreview');
  if (previewButton) previewButton.addEventListener('click', () => openCampaignPreview());

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
      closeCampaignPreview();
      closeFormPreview();
      closeEntriesModal();
      closeEntryDetails();
      closeEntryFullForm();
      closeManualVerificationModal();
      closeManualWinnerModal();
      closeOfficialPostDeleteModal();
      closeActivityDetail();
      closeHelpPopover();
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
    await refreshEntryStatsForShell();
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
  openEntryFullForm,
};
