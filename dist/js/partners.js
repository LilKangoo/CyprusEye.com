(function () {
  const state = {
    sb: null,
    session: null,
    user: null,
    profile: null,
    memberships: [],
    partnersById: {},
    selectedPartnerId: null,
    selectedCategory: 'all',
    fulfillments: [],
    lastFulfillmentsDebug: null,
    itemsByFulfillmentId: {},
    contactsByFulfillmentId: {},
    formSnapshotsByFulfillmentId: {},
    serviceDepositByFulfillmentId: {},
    hotelResourcesById: {},
    hotelBookingsById: {},
    hotelDecisionSupportByBookingId: {},
    transportBookingsById: {},
    blocks: [],
    calendar: {
      resourcesByType: { shop: [], cars: [], trips: [], hotels: [], transport: [] },
      monthValue: '',
      monthBlocks: [],
      monthBusyRanges: [],
    },
    availability: {
      bulkMode: false,
      selectedByType: {
        shop: new Set(),
        cars: new Set(),
        trips: new Set(),
        hotels: new Set(),
        transport: new Set(),
      },
    },
    orders: {
      status: 'all',
      monthValue: '',
      selectedDateIso: '',
      dayListVisible: false,
      calendarExpanded: false,
      compactRows: true,
      filterExpanded: false,
    },
    analytics: {
      period: 'year',
      monthValue: '',
      yearValue: '',
      category: 'all',
      liveTrendType: 'bar',
      liveTrendMetric: 'net',
      liveTrendRows: [],
      liveTrendRange: null,
    },
    linksDiscounts: {
      items: [],
      filter: 'all',
      view: 'services',
      selectedKey: '',
      discountCodes: [],
    },
    partnerBlog: {
      items: [],
      filterSearch: '',
      filterStatus: '',
      resourcesByType: {},
      taxonomySuggestions: {
        categories: { pl: [], en: [] },
        tags: { pl: [], en: [] },
      },
      editors: new Map(),
      tiptapModules: null,
      tiptapFallback: false,
      activeLang: 'pl',
      slugDirtyByLang: { pl: false, en: false },
      pendingAction: 'save',
      dirtyByLang: {
        pl: { title: false, slug: false, lead: false, content_html: false },
        en: { title: false, slug: false, lead: false, content_html: false },
      },
    },
  };

  let blocksRealtimeChannel = null;
  let blocksRealtimeTimer = null;

  let analyticsRealtimeChannel = null;
  let analyticsRealtimeTimer = null;

  let fulfillmentsRealtimeTimer = null;

  let referralTreeRoot = null;
  let referralTreeQuery = '';

  let bootstrapInFlight = false;
  let bootstrapPending = false;
  let authBootstrapTimer = null;
  let lastAuthBootstrapAt = 0;

  const els = {
    warning: null,
    loginPrompt: null,
    btnOpenLogin: null,
    btnHeaderLogin: null,
    noPartner: null,
    servicesCard: null,
    servicesTipsCard: null,
    app: null,
    status: null,
    partnerSelect: null,
    btnRefresh: null,
    suspendedInfo: null,

    partnerDetailsModal: null,
    partnerDetailsDialog: null,
    partnerDetailsClose: null,
    partnerDetailsTitle: null,
    partnerDetailsMeta: null,
    partnerDetailsStatus: null,
    partnerDetailsBody: null,
    partnerDetailsActions: null,
    tabFulfillments: null,
    tabCalendar: null,
    tabBtnFulfillments: null,
    tabBtnCalendar: null,
    fulfillmentsHint: null,
    fulfillmentsBody: null,
    fulfillmentsTableContainer: null,
    btnOrdersFilterToggle: null,
    ordersFilterBody: null,
    ordersFilterCurrent: null,
    ordersFilterToggleState: null,
    ordersStatusButtons: null,
    btnOrdersToggleCompact: null,
    btnOrdersClearFilters: null,
    ordersFilterHint: null,
    btnOrdersCalendarToggle: null,
    ordersCalendarBody: null,
    ordersCalendarToggleState: null,
    ordersCalendarMonthInput: null,
    btnOrdersCalendarPrevMonth: null,
    btnOrdersCalendarNextMonth: null,
    ordersCalendarGrid: null,
    ordersDayListHint: null,
    ordersCalendarList: null,
    kpiPending: null,
    kpiAccepted: null,
    kpiRejected: null,
    blocksBody: null,
    blockForm: null,
    blockResourceType: null,
    blockResourceId: null,
    resourceTypePanels: null,
    resourcePanels: null,
    calendarMonthInput: null,
    calendarPrevMonth: null,
    calendarNextMonth: null,
    calendarMonthGrid: null,
    blockStart: null,
    blockEnd: null,
    blockNote: null,

    availabilityBulkMode: null,
    btnAvailabilitySelectAllType: null,
    btnAvailabilityClearAll: null,
    availabilitySelectionSummary: null,

    partnerAnalyticsCard: null,
    partnerAnalOrdersAccepted: null,
    partnerAnalOrdersPending: null,
    partnerAnalOrdersAwaiting: null,
    partnerAnalOrdersTotal: null,
    partnerAnalPartnerEarnings: null,
    partnerAnalInvited: null,
    partnerAnalHint: null,

    adminMenuToggle: null,
    adminSidebar: null,
    adminSidebarOverlay: null,
    partnerSidebarNav: null,
    partnerNavAll: null,
    partnerNavShop: null,
    partnerNavCars: null,
    partnerNavTrips: null,
    partnerNavHotels: null,
    partnerNavTransport: null,
    partnerNavBlog: null,
    partnerNavCalendar: null,
    partnerNavAnalytics: null,
    partnerNavProfile: null,
    partnerNavReferrals: null,
    partnerNavLinksDiscounts: null,
    partnerUserName: null,
    partnerBreadcrumb: null,

    partnerPortalView: null,
    partnerBlogView: null,
    partnerAnalyticsView: null,
    partnerProfileView: null,

    partnerReferralsView: null,
    partnerLinksDiscountsView: null,

    partnerLinksViewTabs: null,
    partnerLinksFilters: null,
    btnPartnerLinksRefresh: null,
    partnerLinksServicesPanel: null,
    partnerLinksDiscountsPanel: null,
    partnerLinksGrid: null,
    partnerLinksPreviewModal: null,
    partnerLinksPreviewModalOverlay: null,
    btnClosePartnerLinksPreview: null,
    partnerLinksPreviewIntro: null,
    partnerLinksPreviewImage: null,
    partnerLinksPreviewCategory: null,
    partnerLinksPreviewTitle: null,
    partnerLinksPreviewMeta: null,
    partnerLinksPreviewDescription: null,
    partnerLinksPreviewTransportBox: null,
    partnerLinksPreviewTransportPrice: null,
    partnerLinksPreviewTransportNote: null,
    partnerLinksPreviewLandingLinkPl: null,
    partnerLinksPreviewLandingLinkEn: null,
    partnerLinksPreviewOfferLinkPl: null,
    partnerLinksPreviewOfferLinkEn: null,
    btnPartnerLinksCopyLandingPl: null,
    btnPartnerLinksCopyLandingEn: null,
    btnPartnerLinksCopyOfferPl: null,
    btnPartnerLinksCopyOfferEn: null,
    btnPartnerLinksOpenLanding: null,
    btnPartnerLinksOpenOffer: null,
    partnerDiscountCodesList: null,

    partnerBlogCurrentPartner: null,
    partnerBlogStatusHint: null,
    partnerBlogSearch: null,
    partnerBlogStatusFilter: null,
    partnerBlogTableBody: null,
    partnerBlogStatTotal: null,
    partnerBlogStatDraft: null,
    partnerBlogStatPending: null,
    partnerBlogStatApproved: null,
    btnPartnerBlogRefresh: null,
    btnPartnerBlogNew: null,
    partnerBlogModal: null,
    partnerBlogModalOverlay: null,
    btnClosePartnerBlogModal: null,
    partnerBlogModalTitle: null,
    partnerBlogForm: null,
    partnerBlogFormId: null,
    partnerBlogFormStatus: null,
    partnerBlogFormCoverUrl: null,
    btnPartnerBlogCoverUpload: null,
    partnerBlogFormCoverFile: null,
    partnerBlogFormCoverPreview: null,
    partnerBlogFormCoverPreviewImage: null,
    partnerBlogFormCategoriesPl: null,
    partnerBlogFormCategoriesPlSelected: null,
    partnerBlogFormCategoriesPlInput: null,
    partnerBlogFormCategoriesPlSuggestions: null,
    partnerBlogFormCategoriesEn: null,
    partnerBlogFormCategoriesEnSelected: null,
    partnerBlogFormCategoriesEnInput: null,
    partnerBlogFormCategoriesEnSuggestions: null,
    partnerBlogFormTagsPl: null,
    partnerBlogFormTagsPlSelected: null,
    partnerBlogFormTagsPlInput: null,
    partnerBlogFormTagsPlSuggestions: null,
    partnerBlogFormTagsEn: null,
    partnerBlogFormTagsEnSelected: null,
    partnerBlogFormTagsEnInput: null,
    partnerBlogFormTagsEnSuggestions: null,
    partnerBlogEditorRuntimeNote: null,
    btnPartnerBlogAddCta: null,
    partnerBlogFormCtaRows: null,
    btnPartnerBlogDelete: null,
    btnPartnerBlogCancel: null,
    btnPartnerBlogSaveDraft: null,
    btnPartnerBlogSubmit: null,
    btnPartnerBlogSave: null,

    partnerAnalyticsPeriodType: null,
    partnerAnalyticsPeriodYearBtn: null,
    partnerAnalyticsPeriodMonthBtn: null,
    partnerAnalyticsMonth: null,
    partnerAnalyticsMonthWrap: null,
    partnerAnalyticsYear: null,
    partnerAnalyticsYearWrap: null,
    partnerAnalyticsCategoryFilter: null,
    btnPartnerAnalyticsRefresh: null,
    partnerAnalyticsRangeLabel: null,
    partnerAnalyticsStatus: null,
    partnerAnalyticsLiveTrendHint: null,
    partnerLiveTrendTypeBarBtn: null,
    partnerLiveTrendTypeLineBtn: null,
    partnerLiveTrendMetricNetBtn: null,
    partnerLiveTrendMetricGrossBtn: null,
    partnerLiveTrendMetricOrdersBtn: null,
    partnerLiveTrendMetricSoldBtn: null,
    partnerAnalyticsCategoryChips: null,
    partnerAnalyticsLiveChartCard: null,
    partnerAnalyticsLiveChart: null,
    partnerAnalyticsResponseChartCard: null,
    partnerAnalyticsResponseChart: null,

    partnerAnalyticsKpiGross: null,
    partnerAnalyticsKpiNet: null,
    partnerAnalyticsKpiSold: null,
    partnerAnalyticsKpiTotal: null,
    partnerAnalyticsKpiAvg: null,
    partnerAnalyticsKpiPending: null,
    partnerAnalyticsKpiAwaiting: null,
    partnerAnalyticsKpiCancelled: null,
    partnerAnalyticsKpiResponseAvg: null,
    partnerAnalyticsKpiResponseCount: null,

    partnerAnalyticsByTypeBody: null,
    partnerAnalyticsTimeseriesHead: null,
    partnerAnalyticsTimeseriesBody: null,
    partnerAnalyticsTopOffersBody: null,
    partnerAnalyticsTopProductsBody: null,
    partnerAnalyticsByTypeCard: null,
    partnerAnalyticsTimeseriesCard: null,
    partnerAnalyticsTopOffersCard: null,
    partnerAnalyticsTopProductsCard: null,

    partnerReferralWidget: null,
    partnerReferralCount: null,
    partnerReferralLink: null,
    btnPartnerCopyReferralLink: null,

    partnerReferralSummary: null,
    partnerReferralCountSummary: null,
    partnerReferralLinkSummary: null,
    btnPartnerCopyReferralLinkSummary: null,
    partnerReferralCodeSummary: null,
    btnPartnerCopyReferralCodeSummary: null,

    partnerReferralLinkLarge: null,
    btnPartnerCopyReferralLinkLarge: null,
    partnerReferralCodeLarge: null,
    btnPartnerCopyReferralCodeLarge: null,

    partnerReferralStatDirect: null,
    partnerReferralOrdersCard: null,
    btnPartnerReferralOrdersRefresh: null,
    partnerReferralOrdersTotal: null,
    partnerReferralOrdersGross: null,
    partnerReferralOrdersManual: null,
    partnerReferralOrdersLink: null,
    partnerReferralOrdersBody: null,

    partnerReferralTreeContainer: null,
    partnerReferralTreeSearch: null,
    btnPartnerReferralExpandAll: null,
    btnPartnerReferralCollapseAll: null,

    partnerAffiliateCard: null,
    partnerAffiliateUnpaid: null,
    partnerAffiliatePending: null,
    partnerAffiliatePaid: null,
    partnerAffiliateThreshold: null,
    partnerAffiliateProgressText: null,
    partnerAffiliateProgressBar: null,
    btnPartnerAffiliateCashout: null,
    partnerAffiliateCashoutHint: null,
    partnerAffiliateEarningsBody: null,

    partnerAffiliateSummaryCard: null,
    partnerAffiliateSummarySubtitle: null,
    partnerAffiliateSummaryMetrics: null,
    partnerAffiliateSummaryActions: null,
    partnerAffiliateSummaryUnpaid: null,
    partnerAffiliateSummaryPending: null,
    partnerAffiliateSummaryPaid: null,
    partnerAffiliateSummaryThreshold: null,
    partnerAffiliateSummaryProgressText: null,
    partnerAffiliateSummaryProgressBar: null,
    btnPartnerAffiliateSummaryCashout: null,
    partnerAffiliateSummaryCashoutHint: null,

    partnerPortalResponseCard: null,
    partnerPortalEarningsValue: null,
    partnerPortalResponseYearAvg: null,

    partnerProfileMessage: null,
    partnerProfileEmailDisplay: null,
    partnerProfileUsernameDisplay: null,
    partnerProfileNameDisplay: null,
    partnerProfileNameForm: null,
    partnerProfileNameInput: null,
    partnerProfileUsernameForm: null,
    partnerProfileUsernameInput: null,
    partnerProfileEmailForm: null,
    partnerProfileEmailInput: null,
    partnerProfilePasswordForm: null,
    partnerProfilePasswordCurrent: null,
    partnerProfilePasswordNew: null,
    partnerProfilePasswordConfirm: null,

    partnerProfilePayoutForm: null,
    partnerProfilePayoutPartnerName: null,
    partnerProfilePayoutAccountHolder: null,
    partnerProfilePayoutBankName: null,
    partnerProfilePayoutIban: null,
    partnerProfilePayoutBic: null,
    partnerProfilePayoutNotes: null,

    partnerPushStatus: null,
    partnerPushHint: null,
    btnPartnerEnablePush: null,
    btnPartnerDisablePush: null,
  };

  const PARTNER_BLOG_LANGUAGES = [
    { code: 'pl', label: 'Polish' },
    { code: 'en', label: 'English' },
  ];
  const PARTNER_BLOG_TAXONOMY_LANGUAGES = ['pl', 'en'];

  const PARTNER_BLOG_SERVICE_TYPES = [
    { type: 'trips', label: 'Trips' },
    { type: 'hotels', label: 'Hotels' },
    { type: 'cars', label: 'Cars' },
    { type: 'pois', label: 'POIs' },
    { type: 'recommendations', label: 'Recommendations' },
  ];
  const PARTNER_LINKS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'cars', label: 'Cars' },
    { key: 'trips', label: 'Trips' },
    { key: 'hotels', label: 'Hotels' },
    { key: 'transport', label: 'Transport' },
    { key: 'shop', label: 'Shop' },
    { key: 'blog', label: 'Blog' },
  ];
  const PARTNER_BLOG_SERVICE_TYPE_ALIASES = {
    trips: ['trip', 'trips', 'tour', 'tours', 'wycieczka', 'wycieczki'],
    hotels: ['hotel', 'hotels', 'stay', 'stays', 'accommodation', 'accommodations', 'nocleg', 'noclegi'],
    cars: ['car', 'cars', 'car_offer', 'car_offers', 'car-rental', 'car_rental', 'auto', 'auta'],
    pois: ['poi', 'pois', 'place', 'places', 'attraction', 'attractions', 'miejsce', 'miejsca'],
    recommendations: ['recommendation', 'recommendations', 'recommended', 'restaurant', 'restaurants', 'restauracja', 'restauracje'],
  };

  const PARTNER_BLOG_TABLE_SELECT = `
    id,
    status,
    submission_status,
    published_at,
    cover_image_url,
    categories,
    categories_pl,
    categories_en,
    tags,
    tags_pl,
    tags_en,
    cta_services,
    owner_partner_id,
    created_at,
    updated_at,
    translations:blog_post_translations (
      id,
      blog_post_id,
      lang,
      slug,
      title,
      lead,
      content_json,
      content_html
    )
  `;

  const PARTNER_BLOG_TABLE_SELECT_LEGACY = `
    id,
    status,
    submission_status,
    published_at,
    cover_image_url,
    categories,
    tags,
    cta_services,
    owner_partner_id,
    created_at,
    updated_at,
    translations:blog_post_translations (
      id,
      blog_post_id,
      lang,
      slug,
      title,
      lead,
      content_json,
      content_html
    )
  `;

  let partnerDetailsLastFocusedElement = null;
  let partnerDetailsPreviousBodyOverflow = '';
  let partnerDetailsPreviousBodyPosition = '';
  let partnerDetailsPreviousBodyTop = '';
  let partnerDetailsPreviousBodyLeft = '';
  let partnerDetailsPreviousBodyRight = '';
  let partnerDetailsPreviousBodyWidth = '';
  let partnerDetailsPreviousBodyTouchAction = '';
  let partnerDetailsPreviousHtmlOverscroll = '';
  let partnerDetailsScrollY = 0;
  let partnerDetailsUsedGlobalBodyLock = false;

  const isPartnerDetailsModalOpen = () => Boolean(els.partnerDetailsModal?.classList?.contains('is-open'));

  const handlePartnerDetailsTouchMove = (event) => {
    if (!isPartnerDetailsModalOpen()) return;
    const target = event.target;
    if (!(target instanceof Element)) {
      event.preventDefault();
      return;
    }

    // Allow native scrolling only inside modal content area.
    if (els.partnerDetailsBody && els.partnerDetailsBody.contains(target)) return;
    event.preventDefault();
  };

  const lockPartnerDetailsScroll = () => {
    partnerDetailsPreviousBodyOverflow = document.body.style.overflow;
    partnerDetailsPreviousBodyPosition = document.body.style.position;
    partnerDetailsPreviousBodyTop = document.body.style.top;
    partnerDetailsPreviousBodyLeft = document.body.style.left;
    partnerDetailsPreviousBodyRight = document.body.style.right;
    partnerDetailsPreviousBodyWidth = document.body.style.width;
    partnerDetailsPreviousBodyTouchAction = document.body.style.touchAction;
    partnerDetailsPreviousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    partnerDetailsScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('u-lock-scroll', 'is-modal-open');
    document.documentElement.style.overscrollBehavior = 'none';

    try {
      if (typeof window.lockBodyScroll === 'function') {
        window.lockBodyScroll();
        partnerDetailsUsedGlobalBodyLock = true;
      }
    } catch (_e) {
      partnerDetailsUsedGlobalBodyLock = false;
    }

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${partnerDetailsScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
  };

  const unlockPartnerDetailsScroll = () => {
    document.body.classList.remove('u-lock-scroll', 'is-modal-open');
    if (partnerDetailsUsedGlobalBodyLock) {
      try {
        if (typeof window.unlockBodyScroll === 'function') {
          window.unlockBodyScroll();
        }
      } catch (_e) {
      }
    }

    document.body.style.overflow = partnerDetailsPreviousBodyOverflow || '';
    document.body.style.position = partnerDetailsPreviousBodyPosition || '';
    document.body.style.top = partnerDetailsPreviousBodyTop || '';
    document.body.style.left = partnerDetailsPreviousBodyLeft || '';
    document.body.style.right = partnerDetailsPreviousBodyRight || '';
    document.body.style.width = partnerDetailsPreviousBodyWidth || '';
    document.body.style.touchAction = partnerDetailsPreviousBodyTouchAction || '';
    document.documentElement.style.overscrollBehavior = partnerDetailsPreviousHtmlOverscroll || '';

    try {
      window.scrollTo(0, Math.max(0, partnerDetailsScrollY));
    } catch (_e) {
    }

    partnerDetailsUsedGlobalBodyLock = false;
  };

  const handlePartnerDetailsKeydown = (event) => {
    if (!isPartnerDetailsModalOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePartnerDetailsModal({ restoreFocus: true });
    }
  };

  function openPartnerDetailsModal() {
    if (!els.partnerDetailsModal || !els.partnerDetailsDialog) return false;
    if (isPartnerDetailsModalOpen()) return false;

    partnerDetailsLastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    els.partnerDetailsModal.classList.add('is-open');
    els.partnerDetailsModal.setAttribute('aria-hidden', 'false');
    lockPartnerDetailsScroll();
    els.partnerDetailsModal.addEventListener('touchmove', handlePartnerDetailsTouchMove, { passive: false });
    document.addEventListener('keydown', handlePartnerDetailsKeydown);

    requestAnimationFrame(() => {
      try {
        els.partnerDetailsDialog.focus({ preventScroll: true });
      } catch (_e) {}
    });

    return true;
  }

  function closePartnerDetailsModal({ restoreFocus = true } = {}) {
    if (!els.partnerDetailsModal) return false;
    if (!isPartnerDetailsModalOpen()) return false;

    els.partnerDetailsModal.classList.remove('is-open');
    els.partnerDetailsModal.setAttribute('aria-hidden', 'true');
    els.partnerDetailsModal.removeEventListener('touchmove', handlePartnerDetailsTouchMove);
    document.removeEventListener('keydown', handlePartnerDetailsKeydown);
    unlockPartnerDetailsScroll();

    if (restoreFocus && partnerDetailsLastFocusedElement instanceof HTMLElement) {
      try {
        partnerDetailsLastFocusedElement.focus({ preventScroll: true });
      } catch (_e) {}
    }
    partnerDetailsLastFocusedElement = null;
    return true;
  }

  const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/i;

  function $(id) {
    return document.getElementById(id);
  }

  async function refreshAffiliatePanel() {
    if (!els.partnerAffiliateCard) return;
    if (!state.sb || !state.user?.id) {
      els.partnerAffiliateCard.hidden = true;
      return;
    }
    if (!state.selectedPartnerId) {
      els.partnerAffiliateCard.hidden = true;
      return;
    }

    const partner = state.partnersById[state.selectedPartnerId] || null;
    const enabled = Boolean(partner && partner.affiliate_enabled);
    if (!enabled) {
      els.partnerAffiliateCard.hidden = true;
      return;
    }

    els.partnerAffiliateCard.hidden = false;

    const setMoney = (el, value, cur) => {
      if (!el) return;
      el.textContent = formatMoney(value, cur);
    };

    if (els.partnerAffiliateEarningsBody) {
      setHtml(els.partnerAffiliateEarningsBody, '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">Loading…</td></tr>');
    }

    let balanceRow = null;
    try {
      let data = null;
      try {
        const res = await state.sb.rpc('affiliate_get_referrer_balance_v1', { p_partner_id: state.selectedPartnerId });
        if (res.error) throw res.error;
        data = res.data;
      } catch (_e) {
        try {
          const res = await state.sb.rpc('affiliate_get_partner_balance_v2', { p_partner_id: state.selectedPartnerId });
          if (res.error) throw res.error;
          data = res.data;
        } catch (_e2) {
          const res = await state.sb.rpc('affiliate_get_partner_balance', { p_partner_id: state.selectedPartnerId });
          if (res.error) throw res.error;
          data = res.data;
        }
      }
      balanceRow = Array.isArray(data) ? data[0] : data;
    } catch (e) {
      console.error(e);
      if (els.partnerAffiliateProgressText) els.partnerAffiliateProgressText.textContent = 'Failed to load affiliate balance.';
      if (els.btnPartnerAffiliateCashout) els.btnPartnerAffiliateCashout.disabled = true;
      return;
    }

    const unpaid = Number(balanceRow?.unpaid_total || 0) || 0;
    const pending = Number(balanceRow?.pending_total || 0) || 0;
    const paid = Number(balanceRow?.paid_total || 0) || 0;
    const threshold = Number(balanceRow?.payout_threshold || 0) || 0;
    const cur = String(balanceRow?.currency || 'EUR') || 'EUR';

    setMoney(els.partnerAffiliateUnpaid, unpaid, cur);
    setMoney(els.partnerAffiliatePending, pending, cur);
    setMoney(els.partnerAffiliatePaid, paid, cur);
    setMoney(els.partnerAffiliateThreshold, threshold, cur);

    const pct = threshold > 0 ? Math.min(100, Math.max(0, (unpaid / threshold) * 100)) : 0;
    if (els.partnerAffiliateProgressBar) {
      els.partnerAffiliateProgressBar.style.width = `${pct.toFixed(0)}%`;
    }

    if (els.partnerAffiliateProgressText) {
      els.partnerAffiliateProgressText.textContent = `Progress: ${formatMoney(unpaid, cur)} / ${formatMoney(threshold, cur)}`;
    }

    let hasPendingCashoutRequest = false;
    try {
      const { data: reqs } = await state.sb
        .from('affiliate_cashout_requests')
        .select('id, status, created_at')
        .eq('partner_id', state.selectedPartnerId)
        .eq('requested_by', state.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      hasPendingCashoutRequest = Array.isArray(reqs) && reqs.length > 0;
    } catch (_e) {
    }

    const canCashout = threshold > 0 && unpaid >= threshold && pending <= 0 && !hasPendingCashoutRequest;
    if (els.btnPartnerAffiliateCashout) {
      els.btnPartnerAffiliateCashout.disabled = !canCashout;
    }

    if (els.partnerAffiliateCashoutHint) {
      if (hasPendingCashoutRequest) {
        els.partnerAffiliateCashoutHint.textContent = 'Cash out request pending admin review.';
      } else if (pending > 0) {
        els.partnerAffiliateCashoutHint.textContent = 'A payout is already in progress.';
      } else if (threshold > 0 && unpaid < threshold) {
        els.partnerAffiliateCashoutHint.textContent = `Cash out available at ${formatMoney(threshold, cur)}.`;
      } else if (canCashout) {
        els.partnerAffiliateCashoutHint.textContent = 'You can request a cash out now.';
      } else {
        els.partnerAffiliateCashoutHint.textContent = '';
      }
    }

    try {
      const { data: events, error } = await state.sb
        .from('affiliate_commission_events')
        .select('id, partner_id, level, resource_type, booking_id, fulfillment_id, commission_amount, currency, payout_id, created_at')
        .eq('partner_id', state.selectedPartnerId)
        .eq('referrer_user_id', state.user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = Array.isArray(events) ? events : [];
      const payoutIds = Array.from(new Set(rows.map((r) => r.payout_id).filter(Boolean).map((id) => String(id))));
      const payoutStatusById = {};
      if (payoutIds.length) {
        try {
          const { data: payouts, error: pe } = await state.sb
            .from('affiliate_payouts')
            .select('id, status')
            .in('id', payoutIds)
            .limit(500);
          if (pe) throw pe;
          (payouts || []).forEach((p) => {
            if (!p?.id) return;
            payoutStatusById[String(p.id)] = String(p.status || '');
          });
        } catch (_e) {
        }
      }

      const bodyHtml = (() => {
        if (!els.partnerAffiliateEarningsBody) return '';
        if (!rows.length) {
          return '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">No earnings yet.</td></tr>';
        }

        return rows.map((r) => {
          const created = r.created_at ? formatDateDmy(String(r.created_at)) : '—';
          const rt = String(r.resource_type || '').toUpperCase();
          const bid = r.booking_id ? String(r.booking_id).slice(0, 8) : '';
          const service = rt ? `${rt} ${bid ? `#${bid}` : ''}`.trim() : (bid ? `#${bid}` : '—');
          const lvl = r.level != null ? `L${String(r.level)}` : '—';
          const pid = r.payout_id ? String(r.payout_id) : '';
          const payoutStatus = pid ? (payoutStatusById[pid] || 'pending') : '';
          const statusKey = pid
            ? (payoutStatus === 'paid' ? 'paid' : (payoutStatus === 'cancelled' ? 'cancelled' : 'payout'))
            : 'unpaid';
          const statusLabel = statusKey === 'paid'
            ? 'Paid'
            : (statusKey === 'cancelled'
              ? 'Cancel'
              : (statusKey === 'payout' ? 'Payout' : 'Unpaid'));
          const statusTitle = statusKey === 'paid'
            ? 'Paid'
            : (statusKey === 'cancelled'
              ? 'Cancelled'
              : (statusKey === 'payout' ? 'In payout' : 'Unpaid'));
          const statusHtml = `<span class="partner-affiliate-status-badge partner-affiliate-status-badge--${escapeHtml(statusKey)}" title="${escapeHtml(statusTitle)}">${escapeHtml(statusLabel)}</span>`;
          const commission = formatMoney(r.commission_amount, r.currency || cur);
          return `
            <tr>
              <td>${escapeHtml(created)}</td>
              <td>${escapeHtml(service)}</td>
              <td>${escapeHtml(lvl)}</td>
              <td>${statusHtml}</td>
              <td style="text-align:right;">${escapeHtml(commission)}</td>
            </tr>
          `;
        }).join('');
      })();

      if (els.partnerAffiliateEarningsBody) {
        setHtml(els.partnerAffiliateEarningsBody, bodyHtml);
      }
    } catch (e) {
      console.error(e);
      if (els.partnerAffiliateEarningsBody) {
        setHtml(els.partnerAffiliateEarningsBody, '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">Failed to load earnings.</td></tr>');
      }
    }
  }

  function normalizeReferralAttributionSource(value) {
    const source = String(value || '').trim().toLowerCase();
    if (source === 'manual') return 'manual';
    if (source === 'url' || source === 'stored') return source;
    return 'unknown';
  }

  function referralAttributionSourceLabel(source) {
    const normalized = normalizeReferralAttributionSource(source);
    if (normalized === 'manual') return 'Manual';
    if (normalized === 'url') return 'Link';
    if (normalized === 'stored') return 'Saved';
    return 'Unknown';
  }

  function cleanPartnerTransportLabel(value) {
    const text = String(value || '').trim();
    if (!text || text === '—' || /^unknown location$/i.test(text)) return '';
    return text;
  }

  function joinPartnerTransportRoute(originLabel, destinationLabel) {
    const origin = cleanPartnerTransportLabel(originLabel);
    const destination = cleanPartnerTransportLabel(destinationLabel);
    if (!origin && !destination) return '';
    if (origin && destination) return `${origin} → ${destination}`;
    return `${origin || 'Origin'} → ${destination || 'Destination'}`;
  }

  async function loadReferralAttributedOrdersViaRpc(limit = 40) {
    if (!state.sb || !state.selectedPartnerId) return [];
    const { data, error } = await withRateLimitRetry(() => state.sb.rpc('partner_get_referral_attributed_orders', {
      p_partner_id: state.selectedPartnerId,
      p_limit: limit,
    }));
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function loadReferralAttributedOrdersDirect(limit = 40) {
    if (!state.sb || !state.selectedPartnerId) return [];

    const loadTable = async (serviceType, tableName, select) => {
      try {
        const { data, error } = await withRateLimitRetry(() => state.sb
          .from(tableName)
          .select(select)
          .eq('referral_partner_id', state.selectedPartnerId)
          .order('created_at', { ascending: false })
          .limit(limit));
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map((row) => ({
          ...row,
          service_type: serviceType,
        }));
      } catch (_error) {
        return [];
      }
    };

    const [hotelRows, tripRows, carRows, transportRows] = await Promise.all([
      loadTable('hotels', 'hotel_bookings', 'id,created_at,hotel_id,hotel_slug,arrival_date,departure_date,customer_name,total_price,status,referral_code,referral_source,referral_captured_at'),
      loadTable('trips', 'trip_bookings', 'id,created_at,trip_id,trip_slug,trip_date,arrival_date,departure_date,customer_name,total_price,status,referral_code,referral_source,referral_captured_at'),
      loadTable('cars', 'car_bookings', 'id,created_at,offer_id,location,pickup_date,return_date,customer_name,total_price,status,referral_code,referral_source,referral_captured_at'),
      loadTable('transport', 'transport_bookings', 'id,created_at,route_id,travel_date,travel_time,customer_name,total_price,status,payment_status,currency,referral_code,referral_source,referral_captured_at'),
    ]);

    return [...hotelRows, ...tripRows, ...carRows, ...transportRows]
      .sort((a, b) => {
        const aTs = new Date(a?.created_at || 0).getTime() || 0;
        const bTs = new Date(b?.created_at || 0).getTime() || 0;
        return bTs - aTs;
      })
      .slice(0, limit);
  }

  async function enrichReferralAttributedOrders(rows) {
    const items = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
    if (!items.length || !state.sb) return items;

    const hotelIds = Array.from(new Set(items
      .filter((row) => normalizeServiceResourceType(row?.service_type) === 'hotels' && (row?.hotel_id || row?.service_id))
      .map((row) => String(row.hotel_id || row.service_id))));
    const tripIds = Array.from(new Set(items
      .filter((row) => normalizeServiceResourceType(row?.service_type) === 'trips' && (row?.trip_id || row?.service_id))
      .map((row) => String(row.trip_id || row.service_id))));
    const carIds = Array.from(new Set(items
      .filter((row) => normalizeServiceResourceType(row?.service_type) === 'cars' && (row?.offer_id || row?.service_id))
      .map((row) => String(row.offer_id || row.service_id))));
    const routeIds = Array.from(new Set(items
      .filter((row) => normalizeServiceResourceType(row?.service_type) === 'transport' && (row?.route_id || row?.service_id))
      .map((row) => String(row.route_id || row.service_id))));

    const hotelById = {};
    const tripById = {};
    const carById = {};
    const routeById = {};
    const locationById = {};

    if (hotelIds.length) {
      try {
        const { data, error } = await state.sb
          .from('hotels')
          .select('id,slug,title,city')
          .in('id', hotelIds)
          .limit(Math.min(500, hotelIds.length));
        if (error) throw error;
        (data || []).forEach((row) => {
          if (row?.id) hotelById[String(row.id)] = row;
        });
      } catch (_e) {}
    }

    if (tripIds.length) {
      try {
        const { data, error } = await state.sb
          .from('trips')
          .select('id,slug,title,start_city')
          .in('id', tripIds)
          .limit(Math.min(500, tripIds.length));
        if (error) throw error;
        (data || []).forEach((row) => {
          if (row?.id) tripById[String(row.id)] = row;
        });
      } catch (_e) {}
    }

    if (carIds.length) {
      try {
        const { data, error } = await state.sb
          .from('car_offers')
          .select('id,car_model,car_type,location')
          .in('id', carIds)
          .limit(Math.min(500, carIds.length));
        if (error) throw error;
        (data || []).forEach((row) => {
          if (row?.id) carById[String(row.id)] = row;
        });
      } catch (_e) {}
    }

    if (routeIds.length) {
      try {
        const { data: routes, error: routesError } = await state.sb
          .from('transport_routes')
          .select('id,origin_location_id,destination_location_id')
          .in('id', routeIds)
          .limit(Math.min(500, routeIds.length));
        if (routesError) throw routesError;
        (routes || []).forEach((row) => {
          if (row?.id) routeById[String(row.id)] = row;
        });

        const locationIds = Array.from(new Set(
          (routes || []).flatMap((row) => [row?.origin_location_id, row?.destination_location_id]).filter(Boolean).map(String)
        ));
        if (locationIds.length) {
          const { data: locations, error: locationsError } = await state.sb
            .from('transport_locations')
            .select('id,name,code')
            .in('id', locationIds)
            .limit(Math.min(1000, locationIds.length));
          if (locationsError) throw locationsError;
          (locations || []).forEach((row) => {
            if (row?.id) locationById[String(row.id)] = row;
          });
        }
      } catch (_e) {}
    }

    return items.map((row) => {
      const type = normalizeServiceResourceType(row?.service_type);
      const next = { ...row };

      if (type === 'hotels') {
        const hotel = hotelById[String(row?.hotel_id || row?.service_id || '')] || null;
        next.service_title = localizedLabelFromValue(hotel?.title, 'en') || row?.hotel_slug || row?.service_slug || 'Hotel booking';
        next.service_subtitle = String(hotel?.city || '').trim() || String(row?.hotel_slug || row?.service_slug || '').trim();
        next.service_date = String(row?.service_date || row?.arrival_date || row?.created_at || '').trim();
      } else if (type === 'trips') {
        const trip = tripById[String(row?.trip_id || row?.service_id || '')] || null;
        next.service_title = localizedLabelFromValue(trip?.title, 'en') || row?.trip_slug || row?.service_slug || 'Trip booking';
        next.service_subtitle = String(trip?.start_city || '').trim() || String(row?.trip_slug || row?.service_slug || '').trim();
        next.service_date = String(row?.service_date || row?.trip_date || row?.arrival_date || row?.created_at || '').trim();
      } else if (type === 'cars') {
        const car = carById[String(row?.offer_id || row?.service_id || '')] || null;
        const carModel = String(car?.car_model || '').trim();
        const carType = String(car?.car_type || '').trim();
        next.service_title = [carModel, carType].filter(Boolean).join(' • ') || 'Car booking';
        next.service_subtitle = String(car?.location || row?.location || '').trim();
        next.service_date = String(row?.service_date || row?.pickup_date || row?.created_at || '').trim();
      } else if (type === 'transport') {
        const route = routeById[String(row?.route_id || row?.service_id || '')] || null;
        const origin = cleanPartnerTransportLabel(locationById[String(route?.origin_location_id || '')]?.name)
          || cleanPartnerTransportLabel(locationById[String(route?.origin_location_id || '')]?.code);
        const destination = cleanPartnerTransportLabel(locationById[String(route?.destination_location_id || '')]?.name)
          || cleanPartnerTransportLabel(locationById[String(route?.destination_location_id || '')]?.code);
        next.service_title = joinPartnerTransportRoute(origin, destination) || 'Transport booking';
        next.service_subtitle = String(row?.travel_time || '').trim();
        next.service_date = String(row?.service_date || row?.travel_date || row?.created_at || '').trim();
      } else {
        next.service_title = 'Booking';
        next.service_subtitle = '';
        next.service_date = String(row?.created_at || '').trim();
      }

      next.currency = String(row?.currency || 'EUR').trim() || 'EUR';
      return next;
    });
  }

  function renderReferralAttributedOrders(rows) {
    const items = Array.isArray(rows) ? rows : [];

    if (els.partnerReferralOrdersTotal) {
      els.partnerReferralOrdersTotal.textContent = String(items.length);
    }

    const totalGross = items.reduce((sum, row) => sum + (Number(row?.total_amount ?? row?.total_price ?? 0) || 0), 0);
    if (els.partnerReferralOrdersGross) {
      els.partnerReferralOrdersGross.textContent = formatMoney(totalGross, items[0]?.currency || 'EUR');
    }

    const manualCount = items.filter((row) => normalizeReferralAttributionSource(row?.referral_source) === 'manual').length;
    const linkCount = items.filter((row) => {
      const source = normalizeReferralAttributionSource(row?.referral_source);
      return source === 'url' || source === 'stored';
    }).length;

    if (els.partnerReferralOrdersManual) els.partnerReferralOrdersManual.textContent = String(manualCount);
    if (els.partnerReferralOrdersLink) els.partnerReferralOrdersLink.textContent = String(linkCount);

    if (!els.partnerReferralOrdersBody) return;
    if (!items.length) {
      setHtml(els.partnerReferralOrdersBody, '<tr><td colspan="6" class="partner-referral-orders-empty">No referral-attributed orders yet.</td></tr>');
      return;
    }

    const bodyHtml = items.map((row) => {
      const created = row?.created_at ? formatDateDmy(String(row.created_at)) : '—';
      const serviceTitle = String(row?.service_title || '').trim() || 'Booking';
      const serviceSubtitle = String(row?.service_subtitle || '').trim();
      const typeLabel = categoryLabel(normalizeServiceResourceType(row?.service_type) || 'all');
      const source = normalizeReferralAttributionSource(row?.referral_source);
      const sourceBadge = `<span class="partner-referral-orders-source-badge partner-referral-orders-source-badge--${escapeHtml(source)}">${escapeHtml(referralAttributionSourceLabel(source))}</span>`;
      const statusRaw = String(row?.booking_status || row?.status || 'pending').trim();
      const paymentStatus = String(row?.payment_status || '').trim();
      const statusLabel = paymentStatus ? `${statusRaw} / ${paymentStatus}` : statusRaw;
      const codeLabel = String(row?.referral_code || '—').trim() || '—';
      const total = formatMoney(Number(row?.total_amount ?? row?.total_price ?? 0) || 0, row?.currency || 'EUR');

      return `
        <tr>
          <td>${escapeHtml(created)}</td>
          <td>
            <div class="partner-referral-orders-service">
              <strong>${escapeHtml(serviceTitle)}</strong>
              <span>${escapeHtml([typeLabel, serviceSubtitle].filter(Boolean).join(' • '))}</span>
            </div>
          </td>
          <td>${sourceBadge}</td>
          <td>${escapeHtml(statusLabel)}</td>
          <td>${escapeHtml(codeLabel)}</td>
          <td style="text-align:right;">${escapeHtml(total)}</td>
        </tr>
      `;
    }).join('');

    setHtml(els.partnerReferralOrdersBody, bodyHtml);
  }

  async function refreshReferralOrdersPanel() {
    if (!els.partnerReferralOrdersCard) return;
    if (!state.sb || !state.user?.id || !state.selectedPartnerId) {
      els.partnerReferralOrdersCard.hidden = true;
      return;
    }

    els.partnerReferralOrdersCard.hidden = false;
    if (els.partnerReferralOrdersBody) {
      setHtml(els.partnerReferralOrdersBody, '<tr><td colspan="6" class="partner-referral-orders-empty">Loading…</td></tr>');
    }

    let rows = [];
    let rpcFailed = false;
    try {
      rows = await loadReferralAttributedOrdersViaRpc(40);
    } catch (error) {
      rpcFailed = true;
      console.warn('Referral attributed orders RPC unavailable, falling back to direct reads.', error);
      rows = await loadReferralAttributedOrdersDirect(40);
    }

    const enrichedRows = await enrichReferralAttributedOrders(rows);
    renderReferralAttributedOrders(enrichedRows);

    if (!enrichedRows.length && rpcFailed && els.partnerReferralOrdersBody) {
      setHtml(els.partnerReferralOrdersBody, '<tr><td colspan="6" class="partner-referral-orders-empty">No referral-attributed orders yet, or the attribution RPC is not deployed on this database.</td></tr>');
    }
  }

  async function refreshAffiliateSummaryCard() {
    if (!els.partnerAffiliateSummaryCard) return;
    if (!state.sb || !state.user?.id) {
      els.partnerAffiliateSummaryCard.hidden = true;
      return;
    }
    if (!state.selectedPartnerId) {
      els.partnerAffiliateSummaryCard.hidden = true;
      return;
    }

    const { affiliateEnabled } = getSelectedPartnerCapabilities();
    if (!affiliateEnabled) {
      els.partnerAffiliateSummaryCard.hidden = true;
      return;
    }

    const setMoney = (el, value, cur) => {
      if (!el) return;
      el.textContent = formatMoney(value, cur);
    };

    let balanceRow = null;
    try {
      let data = null;
      try {
        const res = await state.sb.rpc('affiliate_get_referrer_balance_v1', { p_partner_id: state.selectedPartnerId });
        if (res.error) throw res.error;
        data = res.data;
      } catch (_e) {
        try {
          const res = await state.sb.rpc('affiliate_get_partner_balance_v2', { p_partner_id: state.selectedPartnerId });
          if (res.error) throw res.error;
          data = res.data;
        } catch (_e2) {
          const res = await state.sb.rpc('affiliate_get_partner_balance', { p_partner_id: state.selectedPartnerId });
          if (res.error) throw res.error;
          data = res.data;
        }
      }
      balanceRow = Array.isArray(data) ? data[0] : data;
    } catch (e) {
      console.error(e);
      if (els.partnerAffiliateSummaryProgressText) els.partnerAffiliateSummaryProgressText.textContent = 'Failed to load affiliate balance.';
      if (els.btnPartnerAffiliateSummaryCashout) els.btnPartnerAffiliateSummaryCashout.disabled = true;
      return;
    }

    const unpaid = Number(balanceRow?.unpaid_total || 0) || 0;
    const pending = Number(balanceRow?.pending_total || 0) || 0;
    const paid = Number(balanceRow?.paid_total || 0) || 0;
    const threshold = Number(balanceRow?.payout_threshold || 0) || 0;
    const cur = String(balanceRow?.currency || 'EUR') || 'EUR';

    setMoney(els.partnerAffiliateSummaryUnpaid, unpaid, cur);
    setMoney(els.partnerAffiliateSummaryPending, pending, cur);
    setMoney(els.partnerAffiliateSummaryPaid, paid, cur);
    setMoney(els.partnerAffiliateSummaryThreshold, threshold, cur);

    const pct = threshold > 0 ? Math.min(100, Math.max(0, (unpaid / threshold) * 100)) : 0;
    if (els.partnerAffiliateSummaryProgressBar) {
      els.partnerAffiliateSummaryProgressBar.style.width = `${pct.toFixed(0)}%`;
    }

    if (els.partnerAffiliateSummaryProgressText) {
      els.partnerAffiliateSummaryProgressText.textContent = `Progress: ${formatMoney(unpaid, cur)} / ${formatMoney(threshold, cur)}`;
    }

    let hasPendingCashoutRequest = false;
    try {
      const { data: reqs } = await state.sb
        .from('affiliate_cashout_requests')
        .select('id, status, created_at')
        .eq('partner_id', state.selectedPartnerId)
        .eq('requested_by', state.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      hasPendingCashoutRequest = Array.isArray(reqs) && reqs.length > 0;
    } catch (_e) {
    }

    const canCashout = threshold > 0 && unpaid >= threshold && pending <= 0 && !hasPendingCashoutRequest;
    if (els.btnPartnerAffiliateSummaryCashout) {
      els.btnPartnerAffiliateSummaryCashout.disabled = !canCashout;
    }

    if (els.partnerAffiliateSummaryCashoutHint) {
      if (hasPendingCashoutRequest) {
        els.partnerAffiliateSummaryCashoutHint.textContent = 'Cash out request pending admin review.';
      } else if (pending > 0) {
        els.partnerAffiliateSummaryCashoutHint.textContent = 'A payout is already in progress.';
      } else if (threshold > 0 && unpaid < threshold) {
        els.partnerAffiliateSummaryCashoutHint.textContent = `Cash out available at ${formatMoney(threshold, cur)}.`;
      } else if (canCashout) {
        els.partnerAffiliateSummaryCashoutHint.textContent = 'You can request a cash out now.';
      } else {
        els.partnerAffiliateSummaryCashoutHint.textContent = '';
      }
    }
  }

  function stopAnalyticsRealtime() {
    if (!analyticsRealtimeChannel || !state.sb) return;
    try {
      if (typeof state.sb.removeChannel === 'function') {
        state.sb.removeChannel(analyticsRealtimeChannel);
      } else if (typeof analyticsRealtimeChannel.unsubscribe === 'function') {
        analyticsRealtimeChannel.unsubscribe();
      }
    } catch (_e) {
    }
    analyticsRealtimeChannel = null;
  }

  function scheduleAnalyticsRealtimeRefresh() {
    if (analyticsRealtimeTimer) {
      clearTimeout(analyticsRealtimeTimer);
    }
    analyticsRealtimeTimer = setTimeout(async () => {
      analyticsRealtimeTimer = null;
      try {
        if (!state.selectedPartnerId) return;
        if (!els.tabFulfillments?.hidden) {
          await refreshPortalResponseInsights();
        }
        if (els.partnerAnalyticsView && !els.partnerAnalyticsView.hidden) {
          await refreshPartnerAnalyticsView({ silent: true });
        }
      } catch (_e) {
      }
    }, 350);
  }

  function scheduleFulfillmentsRealtimeRefresh() {
    if (fulfillmentsRealtimeTimer) {
      clearTimeout(fulfillmentsRealtimeTimer);
    }
    fulfillmentsRealtimeTimer = setTimeout(async () => {
      fulfillmentsRealtimeTimer = null;
      try {
        if (!state.selectedPartnerId) return;
        if (els.tabFulfillments?.hidden) return;
        await loadFulfillments();
        updateSidebarCategoryVisibility();
        refreshOrdersPanelViews();
      } catch (_e) {
      }
    }, 350);
  }

  function startAnalyticsRealtime() {
    stopAnalyticsRealtime();
    if (!state.sb || typeof state.sb.channel !== 'function') return;
    if (!state.selectedPartnerId) return;

    try {
      analyticsRealtimeChannel = state.sb
        .channel(`partner-analytics-${String(state.selectedPartnerId).slice(0, 8)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'partner_service_fulfillments', filter: `partner_id=eq.${state.selectedPartnerId}` },
          () => {
            scheduleAnalyticsRealtimeRefresh();
            scheduleFulfillmentsRealtimeRefresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shop_order_fulfillments', filter: `partner_id=eq.${state.selectedPartnerId}` },
          () => {
            scheduleAnalyticsRealtimeRefresh();
            scheduleFulfillmentsRealtimeRefresh();
          }
        )
        .subscribe();
    } catch (_e) {
      analyticsRealtimeChannel = null;
    }
  }

  const PARTNER_AUTH_ERROR_RE = /jwt expired|expired jwt|invalid jwt|token expired|auth session missing|session expired|unauthorized|forbidden/i;
  const PARTNER_RATE_LIMIT_RE = /over_request_rate_limit|rate limit reached|too many requests/i;
  const PARTNER_PERMISSION_RE = /permission denied|insufficient privilege|row-level security|rls|42501|forbidden/i;

  function isPartnerAuthError(value) {
    const authUtils = (typeof window !== 'undefined' && window.CE_AUTH_UTILS && typeof window.CE_AUTH_UTILS.isRecoverableError === 'function')
      ? window.CE_AUTH_UTILS
      : null;
    if (authUtils && authUtils.isRecoverableError(value)) return true;
    const raw = String(value?.message || value || '').trim().toLowerCase();
    if (!raw) return false;
    return PARTNER_AUTH_ERROR_RE.test(raw);
  }

  function isPartnerRateLimitError(value) {
    const code = String(value?.code || '').trim().toLowerCase();
    const raw = String(value?.message || value || '').trim().toLowerCase();
    if (!raw && !code) return false;
    if (code === 'over_request_rate_limit') return true;
    return PARTNER_RATE_LIMIT_RE.test(`${code} ${raw}`);
  }

  function isPartnerPermissionError(value) {
    const code = String(value?.code || '').trim().toLowerCase();
    const raw = String(value?.message || value || '').trim().toLowerCase();
    if (!raw && !code) return false;
    if (code === '42501' || code === 'insufficient_privilege') return true;
    return PARTNER_PERMISSION_RE.test(`${code} ${raw}`);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  async function withRateLimitRetry(task, options = {}) {
    const attempts = Math.max(1, Number(options.attempts || 3));
    const baseDelayMs = Math.max(100, Number(options.baseDelayMs || 400));
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await task(attempt);
        if (result && typeof result === 'object' && 'error' in result && result.error) {
          throw result.error;
        }
        return result;
      } catch (error) {
        lastError = error;
        const shouldRetry = isPartnerRateLimitError(error) && attempt < attempts - 1;
        if (!shouldRetry) {
          throw error;
        }
        await delay(baseDelayMs * (attempt + 1));
      }
    }

    throw lastError || new Error('Request failed');
  }

  function queueBootstrapFromAuth() {
    const now = Date.now();
    const minGapMs = 1200;
    const elapsed = now - lastAuthBootstrapAt;

    if (elapsed >= minGapMs) {
      lastAuthBootstrapAt = now;
      void bootstrapPortal();
      return;
    }

    if (authBootstrapTimer) return;

    authBootstrapTimer = setTimeout(() => {
      authBootstrapTimer = null;
      lastAuthBootstrapAt = Date.now();
      void bootstrapPortal();
    }, Math.max(80, minGapMs - elapsed));
  }

  function partnerUserMessage(value, fallback = '') {
    const authUtils = (typeof window !== 'undefined' && window.CE_AUTH_UTILS && typeof window.CE_AUTH_UTILS.toUserMessage === 'function')
      ? window.CE_AUTH_UTILS
      : null;
    const raw = String(value?.message || value || '').trim();
    if (!raw) return fallback;
    if (authUtils && typeof authUtils.toUserMessage === 'function') {
      return authUtils.toUserMessage(raw, fallback || 'Session expired. Please sign in again.');
    }
    if (isPartnerAuthError(raw)) {
      return fallback || 'Session expired. Please sign in again.';
    }
    return raw;
  }

  function showToast(message, type) {
    const normalizedType = type || 'info';
    const normalizedMessage = partnerUserMessage(message, normalizedType === 'error' ? 'Session expired. Please sign in again.' : '');
    if (!normalizedMessage) return;
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(normalizedMessage, normalizedType);
      return;
    }
    console.log(normalizedType, normalizedMessage);
  }

  function supportsPartnerPushNotifications() {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  function isIosDevice() {
    const ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua);
  }

  function isStandaloneDisplayMode() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    return Boolean((navigator).standalone);
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (String(base64String || '') + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function ensurePartnersServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }
    if (!window.isSecureContext) {
      throw new Error('Push requires HTTPS');
    }

    const existing = await navigator.serviceWorker.getRegistration('/partners/');
    if (existing) return existing;

    return navigator.serviceWorker.register('/partners/sw.js', { scope: '/partners/' });
  }

  async function fetchPartnerVapidPublicKey() {
    if (!state.sb) throw new Error('Supabase client not available');
    if (!state.sb.functions || typeof state.sb.functions.invoke !== 'function') {
      throw new Error('Supabase functions not available');
    }

    const token = String(state.session?.access_token || '').trim();

    const { data, error, response } = await state.sb.functions.invoke('get-partner-vapid-public-key', {
      body: {},
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (error) {
      const status = Number(response?.status || 0);

      let bodyText = '';
      try {
        bodyText = response ? await response.clone().text() : '';
      } catch (_e) {
      }

      let bodyMsg = String(bodyText || '').trim();
      let parsedBody = null;
      let bodyMsgFromErrorField = false;
      try {
        parsedBody = bodyMsg ? JSON.parse(bodyMsg) : null;
        if (parsedBody && typeof parsedBody === 'object' && parsedBody.error) {
          bodyMsg = String(parsedBody.error || '').trim();
          bodyMsgFromErrorField = true;
        }
      } catch (_e) {
      }

      let msg = String(error?.message || 'Failed to fetch VAPID public key');
      if (status === 401) msg = 'Unauthorized (please sign in again)';
      if (status === 403) msg = 'Forbidden (partner access required)';
      if (status === 404) msg = 'Missing Edge Function (not deployed)';

      const isSupabaseNotFound =
        status === 404 &&
        parsedBody &&
        typeof parsedBody === 'object' &&
        String(parsedBody.code || '').toUpperCase() === 'NOT_FOUND';

      if (bodyMsg && (status !== 404 || bodyMsgFromErrorField) && !isSupabaseNotFound) msg = bodyMsg;

      const details = status ? ` (HTTP ${status}${bodyMsg ? `: ${bodyMsg}` : ''})` : '';
      throw new Error(`${msg}${details}`);
    }

    const publicKey = String(data?.publicKey || '').trim();
    if (!publicKey) throw new Error('Missing VAPID public key');
    return publicKey;
  }

  async function upsertPartnerPushSubscriptionForAllMemberships(subscription) {
    if (!state.sb) throw new Error('Supabase client not available');
    const userId = String(state.user?.id || '').trim();
    if (!userId) throw new Error('Not authenticated');

    const memberships = Array.isArray(state.memberships) ? state.memberships : [];
    const partnerIds = memberships.map((m) => String(m?.partner_id || '').trim()).filter(Boolean);
    if (!partnerIds.length) throw new Error('No partner membership');

    const json = (subscription && typeof subscription.toJSON === 'function') ? subscription.toJSON() : {};
    const endpoint = String(json.endpoint || subscription?.endpoint || '').trim();
    const keys = json.keys || {};

    const basePayload = {
      user_id: userId,
      endpoint,
      p256dh: String(keys.p256dh || '').trim(),
      auth: String(keys.auth || '').trim(),
      subscription: json,
      user_agent: navigator.userAgent || null,
      last_seen_at: new Date().toISOString(),
    };

    for (const partnerId of partnerIds) {
      const payload = { ...basePayload, partner_id: partnerId };
      const { error } = await state.sb
        .from('partner_push_subscriptions')
        .upsert(payload, { onConflict: 'user_id,partner_id,endpoint' });
      if (error) throw error;
    }
  }

  async function deletePartnerPushSubscriptionByEndpoint(endpoint) {
    if (!state.sb) throw new Error('Supabase client not available');
    const userId = String(state.user?.id || '').trim();
    if (!userId) throw new Error('Not authenticated');

    const ep = String(endpoint || '').trim();
    if (!ep) return;

    const { error } = await state.sb
      .from('partner_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', ep);
    if (error) throw error;
  }

  async function loadPartnerPushNotificationSettings() {
    const statusEl = els.partnerPushStatus;
    const hintEl = els.partnerPushHint;
    const btnEnable = els.btnPartnerEnablePush;
    const btnDisable = els.btnPartnerDisablePush;

    if (!statusEl || !btnEnable || !btnDisable) return;

    const setHint = (text) => {
      if (!hintEl) return;
      hintEl.textContent = String(text || '');
    };

    if (!state.session || !state.user) {
      statusEl.textContent = 'Log in required';
      btnEnable.hidden = true;
      btnDisable.hidden = true;
      setHint('Sign in to manage push notifications.');
      return;
    }

    const ios = isIosDevice();
    const standalone = isStandaloneDisplayMode();
    if (ios && !standalone) {
      statusEl.textContent = 'Install required';
      btnEnable.hidden = true;
      btnDisable.hidden = true;
      setHint('On iPhone, push works only after installing the app (Share → Add to Home Screen) and opening it from the Home Screen.');
      return;
    }

    if (!supportsPartnerPushNotifications()) {
      statusEl.textContent = 'Unsupported';
      btnEnable.hidden = true;
      btnDisable.hidden = true;
      setHint('Your browser/device does not support Web Push, or the page is not served over HTTPS.');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      statusEl.textContent = 'Blocked';
      btnEnable.hidden = true;
      btnDisable.hidden = true;
      setHint('Notifications are blocked in your browser. Unblock them in browser settings and refresh.');
      return;
    }

    if (permission !== 'granted') {
      statusEl.textContent = 'Disabled';
      btnEnable.hidden = false;
      btnDisable.hidden = true;
      setHint('Click "Enable push" to request permission.');
      return;
    }

    try {
      const reg = await ensurePartnersServiceWorkerRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        statusEl.textContent = 'Enabled';
        btnEnable.hidden = true;
        btnDisable.hidden = false;
        setHint('Push is active on this device.');
      } else {
        statusEl.textContent = 'Disabled';
        btnEnable.hidden = false;
        btnDisable.hidden = true;
        setHint('Permission is granted, but there is no subscription yet. Click "Enable push" to subscribe.');
      }
    } catch (e) {
      statusEl.textContent = 'Error';
      btnEnable.hidden = false;
      btnDisable.hidden = true;
      setHint(String(e?.message || 'Failed to initialize push.'));
    }
  }

  async function enablePartnerPushNotifications() {
    try {
      if (!state.session || !state.user) {
        showToast('Please log in to enable push.', 'error');
        await loadPartnerPushNotificationSettings();
        return;
      }

      if (isIosDevice() && !isStandaloneDisplayMode()) {
        showToast('Install required: add to Home Screen and open the app to enable push on iPhone.', 'info');
        await loadPartnerPushNotificationSettings();
        return;
      }

      if (!supportsPartnerPushNotifications()) {
        showToast('Push is not supported on this device', 'error');
        await loadPartnerPushNotificationSettings();
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Notification permission was not granted', 'error');
        await loadPartnerPushNotificationSettings();
        return;
      }

      const reg = await ensurePartnersServiceWorkerRegistration();
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await upsertPartnerPushSubscriptionForAllMemberships(existing);
        showToast('Push was already enabled (subscription refreshed)', 'success');
        await loadPartnerPushNotificationSettings();
        return;
      }

      const publicKey = await fetchPartnerVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      await upsertPartnerPushSubscriptionForAllMemberships(subscription);
      showToast('Push enabled', 'success');
    } catch (e) {
      console.error('Failed to enable partner push:', e);
      showToast(String(e?.message || 'Failed to enable push'), 'error');
    } finally {
      await loadPartnerPushNotificationSettings();
    }
  }

  async function disablePartnerPushNotifications() {
    try {
      if (!supportsPartnerPushNotifications()) {
        await loadPartnerPushNotificationSettings();
        return;
      }

      const reg = await ensurePartnersServiceWorkerRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        showToast('Push was already disabled', 'info');
        await loadPartnerPushNotificationSettings();
        return;
      }

      const endpoint = sub.endpoint;
      try {
        await sub.unsubscribe();
      } catch (_e) {
      }

      await deletePartnerPushSubscriptionByEndpoint(endpoint);
      showToast('Push disabled', 'success');
    } catch (e) {
      console.error('Failed to disable partner push:', e);
      showToast(String(e?.message || 'Failed to disable push'), 'error');
    } finally {
      await loadPartnerPushNotificationSettings();
    }
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text || '';
  }

  function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function getSelectedPartnerCapabilities() {
    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const hasShopFulfillments = (state.fulfillments || []).some((f) => f && String(f.__source || '') === 'shop');
    const canShop = Boolean(partner?.can_manage_shop && (partner?.shop_vendor_id || hasShopFulfillments));
    const canCars = Boolean(partner?.can_manage_cars);
    const canTrips = Boolean(partner?.can_manage_trips);
    const canHotels = Boolean(partner?.can_manage_hotels);
    const canBlog = Boolean(partner?.can_manage_blog);
    const canTransport = Boolean(partner?.can_manage_transport);
    const hasAnyServicePermission = Boolean(
      partner?.can_manage_shop
      || partner?.can_manage_cars
      || partner?.can_manage_trips
      || partner?.can_manage_hotels
      || partner?.can_manage_blog
      || partner?.can_manage_transport
    );
    const affiliateEnabled = Boolean(partner?.affiliate_enabled);
    const isAffiliateOnly = Boolean(affiliateEnabled && !hasAnyServicePermission);
    return { partner, canShop, canCars, canTrips, canHotels, canBlog, canTransport, hasAnyServicePermission, affiliateEnabled, isAffiliateOnly };
  }

  function updateServiceSectionVisibility() {
    const { isAffiliateOnly } = getSelectedPartnerCapabilities();
    setHidden(els.servicesCard, isAffiliateOnly);
    setHidden(els.servicesTipsCard, isAffiliateOnly);
    setHidden(els.partnerNavCalendar, isAffiliateOnly);
    setHidden(els.partnerNavAnalytics, isAffiliateOnly);
  }

  function updateAffiliateSummaryCardVisibility() {
    const inPortal = Boolean(els.partnerPortalView && !els.partnerPortalView.hidden);
    const inFulfillmentsTab = Boolean(els.tabFulfillments && !els.tabFulfillments.hidden);
    const { affiliateEnabled, isAffiliateOnly } = getSelectedPartnerCapabilities();
    const tabOk = isAffiliateOnly ? true : inFulfillmentsTab;
    const canShow = inPortal && tabOk && affiliateEnabled && Boolean(state.session && state.user && state.selectedPartnerId);
    setHidden(els.partnerAffiliateSummaryCard, !canShow);

    if (!els.partnerAffiliateSummaryCard) return;
    const compact = Boolean(canShow && !isAffiliateOnly);
    els.partnerAffiliateSummaryCard.classList.toggle('partner-affiliate-summary--compact', compact);
    setHidden(els.partnerAffiliateSummaryMetrics, compact);
    setHidden(els.partnerAffiliateSummaryActions, compact);
    if (els.partnerAffiliateSummarySubtitle) {
      els.partnerAffiliateSummarySubtitle.textContent = compact
        ? 'Payout progress'
        : 'Commissions from referred users';
    }
  }

  function updateAnalyticsCardVisibility() {
    setHidden(els.partnerAnalyticsCard, true);
  }

  async function copyTextToClipboard(text) {
    const value = String(text || '').trim();
    if (!value) return false;

    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_e) {
    }

    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_e) {
      return false;
    }
  }

  function isUuid(value) {
    const v = String(value || '').trim();
    if (!v) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }

  function normalizeReferralCode(value) {
    const bootstrap = window.CE_REFERRAL_BOOTSTRAP || null;
    if (bootstrap?.normalizeCode) return bootstrap.normalizeCode(value);
    const raw = String(value || '').trim();
    return /^[A-Za-z0-9_]+$/.test(raw) ? raw : '';
  }

  function getProfileReferralCode(profile) {
    const referralCode = normalizeReferralCode(profile?.referral_code || '');
    if (referralCode) return referralCode;
    const username = String(profile?.username || '').trim();
    if (!username || isUuid(username)) return '';
    return normalizeReferralCode(username);
  }

  function buildReferralLink(code, targetUrl) {
    const referralCode = normalizeReferralCode(code);
    if (!referralCode) return '';
    const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : 'https://cypruseye.com';
    try {
      const url = new URL(String(targetUrl || `${baseUrl}/`), baseUrl);
      url.searchParams.set('ref', referralCode);
      return url.toString();
    } catch (_error) {
      return `${baseUrl}/?ref=${encodeURIComponent(referralCode)}`;
    }
  }

  function setProfileMessage(text) {
    if (!els.partnerProfileMessage) return;
    els.partnerProfileMessage.textContent = text || '';
  }

  function setMainView(view) {
    const isAnalytics = view === 'analytics';
    const isBlog = view === 'blog';
    const isProfile = view === 'profile';
    const isReferrals = view === 'referrals';
    const isLinksDiscounts = view === 'links-discounts';
    const isPortal = !isProfile && !isReferrals && !isAnalytics && !isBlog && !isLinksDiscounts;

    setHidden(els.partnerPortalView, !isPortal);
    setHidden(els.partnerBlogView, !isBlog);
    setHidden(els.partnerAnalyticsView, !isAnalytics);
    setHidden(els.partnerProfileView, !isProfile);
    setHidden(els.partnerReferralsView, !isReferrals);
    setHidden(els.partnerLinksDiscountsView, !isLinksDiscounts);
    if (!isLinksDiscounts && els.partnerLinksPreviewModal && !els.partnerLinksPreviewModal.hidden) {
      closePartnerLinksPreview();
    }

    updateAnalyticsCardVisibility();
    updateAffiliateSummaryCardVisibility();
    updateServiceSectionVisibility();
  }

  function setSidebarActive(targetBtn) {
    const btns = [
      els.partnerNavAll,
      els.partnerNavShop,
      els.partnerNavCars,
      els.partnerNavTrips,
      els.partnerNavHotels,
      els.partnerNavTransport,
      els.partnerNavBlog,
      els.partnerNavCalendar,
      els.partnerNavAnalytics,
      els.partnerNavProfile,
      els.partnerNavReferrals,
      els.partnerNavLinksDiscounts,
    ].filter(Boolean);
    btns.forEach((b) => b.classList.toggle('active', b === targetBtn));
  }

  async function loadMyProfile() {
    if (!state.sb || !state.user?.id) return null;

    try {
      const { data, error } = await withRateLimitRetry(() => state.sb
        .from('profiles')
        .select('id,email,name,username,referral_code,referred_by')
        .eq('id', state.user.id)
        .maybeSingle());
      if (error) throw error;
      state.profile = data || null;
      return state.profile;
    } catch (_e) {
      state.profile = null;
      return null;
    }
  }

  function renderProfileSettings() {
    const email = state.user?.email || state.profile?.email || '—';
    const username = state.profile?.username || '—';
    const name = state.profile?.name || '—';

    setText(els.partnerProfileEmailDisplay, email);
    setText(els.partnerProfileUsernameDisplay, username);
    setText(els.partnerProfileNameDisplay, name);

    if (els.partnerProfileNameInput) {
      els.partnerProfileNameInput.value = state.profile?.name ? String(state.profile.name) : '';
    }
    if (els.partnerProfileUsernameInput) {
      els.partnerProfileUsernameInput.value = state.profile?.username ? String(state.profile.username) : '';
    }
    if (els.partnerProfileEmailInput) {
      els.partnerProfileEmailInput.value = state.user?.email ? String(state.user.email) : '';
    }

    if (els.partnerProfilePayoutPartnerName) {
      const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
      const label = partner?.name ? `Partner: ${String(partner.name)}` : (state.selectedPartnerId ? `Partner: ${String(state.selectedPartnerId).slice(0, 8)}` : 'Partner: —');
      els.partnerProfilePayoutPartnerName.textContent = label;
    }

    if (els.partnerProfilePayoutForm) {
      const pid = String(state.selectedPartnerId || '').trim();
      const canEdit = pid && Array.isArray(state.memberships) && state.memberships.some((m) => String(m?.partner_id || '') === pid && String(m?.role || '') === 'owner');
      Array.from(els.partnerProfilePayoutForm.querySelectorAll('input, textarea, button')).forEach((el) => {
        el.disabled = !canEdit;
      });
    }
  }

  async function loadPartnerPayoutDetails() {
    if (!state.sb || !state.user?.id) return null;
    if (!state.selectedPartnerId) return null;

    try {
      const { data, error } = await state.sb
        .from('partner_payout_details')
        .select('partner_id, account_holder_name, bank_name, iban, bic, notes, updated_at')
        .eq('partner_id', state.selectedPartnerId)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (_e) {
      return null;
    }
  }

  function renderPartnerPayoutDetails(row) {
    if (els.partnerProfilePayoutAccountHolder) els.partnerProfilePayoutAccountHolder.value = row?.account_holder_name || '';
    if (els.partnerProfilePayoutBankName) els.partnerProfilePayoutBankName.value = row?.bank_name || '';
    if (els.partnerProfilePayoutIban) els.partnerProfilePayoutIban.value = row?.iban || '';
    if (els.partnerProfilePayoutBic) els.partnerProfilePayoutBic.value = row?.bic || '';
    if (els.partnerProfilePayoutNotes) els.partnerProfilePayoutNotes.value = row?.notes || '';
  }

  async function refreshReferralWidget() {
    if (!state.sb || !state.user?.id) {
      setHidden(els.partnerReferralWidget, true);
      setHidden(els.partnerReferralSummary, true);
      return;
    }

    const ensureVisible = () => {
      if (els.partnerReferralWidget) els.partnerReferralWidget.hidden = false;
      if (els.partnerReferralSummary) els.partnerReferralSummary.hidden = false;
    };

    ensureVisible();

    try {
      const { count, error } = await withRateLimitRetry(() => state.sb
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', state.user.id)
        .limit(1));
      if (error) throw error;
      const c = String(count || 0);
      setText(els.partnerReferralCount, c);
      setText(els.partnerReferralCountSummary, c);
    } catch (_e) {
      setText(els.partnerReferralCount, '0');
      setText(els.partnerReferralCountSummary, '0');
    }

    const referralCode = getProfileReferralCode(state.profile || null);
    const canUse = Boolean(referralCode);
    const link = canUse ? buildReferralLink(referralCode) : 'Set your referral code to enable referral link';
    if (els.partnerReferralLink) {
      els.partnerReferralLink.value = link;
    }
    if (els.partnerReferralLinkSummary) {
      els.partnerReferralLinkSummary.value = link;
    }
    if (els.partnerReferralCodeSummary) {
      els.partnerReferralCodeSummary.value = referralCode;
    }
    if (els.partnerReferralLinkLarge) {
      els.partnerReferralLinkLarge.value = link;
    }
    if (els.partnerReferralCodeLarge) {
      els.partnerReferralCodeLarge.value = referralCode;
    }
    if (els.btnPartnerCopyReferralLink) {
      els.btnPartnerCopyReferralLink.disabled = !canUse;
    }
    if (els.btnPartnerCopyReferralLinkSummary) {
      els.btnPartnerCopyReferralLinkSummary.disabled = !canUse;
    }
    if (els.btnPartnerCopyReferralCodeSummary) {
      els.btnPartnerCopyReferralCodeSummary.disabled = !canUse;
    }
    if (els.btnPartnerCopyReferralLinkLarge) {
      els.btnPartnerCopyReferralLinkLarge.disabled = !canUse;
    }
    if (els.btnPartnerCopyReferralCodeLarge) {
      els.btnPartnerCopyReferralCodeLarge.disabled = !canUse;
    }
  }

  function openSidebar() {
    if (!els.adminSidebar) return;
    els.adminSidebar.classList.add('is-open');
    if (els.adminSidebarOverlay) {
      els.adminSidebarOverlay.hidden = false;
      els.adminSidebarOverlay.classList.add('is-active');
    }
    document.body.classList.add('admin-sidebar-open');
    if (els.adminMenuToggle) {
      els.adminMenuToggle.setAttribute('aria-expanded', 'true');
    }
  }

  function closeSidebar() {
    if (!els.adminSidebar) return;
    els.adminSidebar.classList.remove('is-open');
    if (els.adminSidebarOverlay) {
      els.adminSidebarOverlay.classList.remove('is-active');
      els.adminSidebarOverlay.hidden = true;
    }
    document.body.classList.remove('admin-sidebar-open');
    if (els.adminMenuToggle) {
      els.adminMenuToggle.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleSidebar() {
    if (!els.adminSidebar) return;
    const isOpen = els.adminSidebar.classList.contains('is-open');
    if (isOpen) closeSidebar();
    else openSidebar();
  }

  function categoryLabel(category) {
    const c = String(category || '').trim();
    if (c === 'shop') return 'Shop';
    if (c === 'cars') return 'Cars';
    if (c === 'trips') return 'Trips';
    if (c === 'hotels') return 'Hotels';
    if (c === 'transport') return 'Transport';
    return 'All';
  }

  function filteredFulfillmentsForSelectedCategory() {
    const cat = String(state.selectedCategory || 'all');
    return (state.fulfillments || []).filter((f) => {
      if (cat === 'all') return true;
      if (!f) return false;
      if (cat === 'shop') return String(f.__source || '') === 'shop';
      if (String(f.__source || '') === 'shop') return false;
      return normalizeServiceResourceType(f.resource_type) === cat;
    });
  }

  function normalizeOrdersStatus(value) {
    const v = String(value || 'all').trim().toLowerCase();
    if (v === 'pending_acceptance') return 'pending_acceptance';
    if (v === 'awaiting_payment') return 'awaiting_payment';
    if (v === 'confirmed') return 'confirmed';
    if (v === 'cancelled_rejected') return 'cancelled_rejected';
    return 'all';
  }

  function formatOrdersStatusLabel(status) {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'pending_acceptance') return 'Pending acceptance';
    if (s === 'awaiting_payment') return 'Awaiting payment';
    if (s === 'confirmed') return 'Confirmed';
    if (s === 'cancelled_rejected') return 'Canceled / rejected';
    return '—';
  }

  function localDateIso(date = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function normalizeIsoDateValue(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms).toISOString().slice(0, 10);
  }

  function detailsObjectFromFulfillment(row) {
    const raw = row?.details;
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_e) {
      return null;
    }
  }

  function normalizeServiceResourceType(value) {
    const type = String(value || '').trim().toLowerCase();
    if (!type) return '';
    if (type === 'car') return 'cars';
    if (type === 'trip') return 'trips';
    if (type === 'hotel') return 'hotels';
    if (type === 'transfer' || type === 'transfers' || type === 'transports') return 'transport';
    return type;
  }

  function localizedLabelFromValue(value, preferred = 'en') {
    if (value == null) return '';
    if (typeof value === 'string') return String(value).trim();
    if (typeof value !== 'object') return String(value || '').trim();
    const primary = String(preferred || 'en').trim().toLowerCase() || 'en';
    const candidates = [
      value[primary],
      value.en,
      value.pl,
      value.el,
      value.he,
      ...Object.values(value),
    ];
    return String(candidates.find((entry) => String(entry || '').trim()) || '').trim();
  }

  function hotelDateRangesOverlap(startA, endA, startB, endB) {
    const aStart = normalizeIsoDateValue(startA);
    const aEnd = normalizeIsoDateValue(endA);
    const bStart = normalizeIsoDateValue(startB);
    const bEnd = normalizeIsoDateValue(endB);
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart < bEnd && bStart < aEnd;
  }

  function buildGoogleMapsHref(location = {}) {
    const direct = String(location.google_maps_url || location.hotel_maps_url || '').trim();
    if (direct) return direct;
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
    }
    return '';
  }

  function fulfillmentCategoryForOrders(row) {
    if (!row) return '';
    if (String(row.__source || '') === 'shop') return 'shop';
    const type = normalizeServiceResourceType(row.resource_type);
    if (type === 'cars' || type === 'trips' || type === 'hotels' || type === 'transport') return type;
    return '';
  }

  function fulfillmentStatusForOrders(row) {
    if (!row) return '';
    const source = String(row.__source || '').trim().toLowerCase();
    const raw = String(row.status || '').trim().toLowerCase();
    const resolved = String(resolveServiceOrderStatus(row) || '').trim().toLowerCase();

    if (source === 'shop') {
      if (raw === 'pending_acceptance') return 'pending_acceptance';
      if (raw === 'awaiting_payment') return 'awaiting_payment';
      if (raw === 'accepted') return 'confirmed';
      if (raw === 'completed' || raw === 'fulfilled') return 'confirmed';
      if (raw === 'rejected' || raw === 'cancelled' || raw === 'expired' || raw === 'closed') return 'cancelled_rejected';
      return 'pending_acceptance';
    }

    if (raw === 'awaiting_payment') return 'awaiting_payment';
    if (resolved === 'confirmed' || resolved === 'completed' || raw === 'accepted') return 'confirmed';
    if (resolved === 'cancelled' || raw === 'rejected' || raw === 'expired' || raw === 'cancelled' || raw === 'closed') return 'cancelled_rejected';
    return 'pending_acceptance';
  }

  function isFulfillmentPaidForOrders(row) {
    if (!row) return false;
    const source = String(row.__source || '').trim().toLowerCase();
    if (source !== 'service') return false;
    const paymentStatus = String(row.booking_payment_status || '').trim().toLowerCase();
    return paymentStatus === 'paid';
  }

  function firstIsoFromCandidates(candidates) {
    const list = Array.isArray(candidates) ? candidates : [];
    for (const candidate of list) {
      const iso = normalizeIsoDateValue(candidate);
      if (iso) return iso;
    }
    return '';
  }

  function fulfillmentScheduleRange(row) {
    if (!row) return null;
    const category = fulfillmentCategoryForOrders(row);
    const details = detailsObjectFromFulfillment(row);
    const transportBooking = category === 'transport'
      ? (state.transportBookingsById[String(row?.booking_id || '').trim()] || null)
      : null;
    let startIso = '';
    let endIso = '';
    if (category === 'cars') {
      startIso = firstIsoFromCandidates([
        row.start_date,
        details?.pickup_date,
        details?.pickupDate,
        details?.start_date,
        details?.startDate
      ]);
      endIso = firstIsoFromCandidates([
        row.end_date,
        details?.return_date,
        details?.returnDate,
        details?.end_date,
        details?.endDate,
      ]);
    } else if (category === 'trips') {
      startIso = firstIsoFromCandidates([
        details?.preferred_date,
        details?.preferredDate,
        details?.trip_date,
        details?.tripDate,
        row.start_date,
        details?.start_date,
        details?.startDate,
        details?.arrival_date,
        details?.arrivalDate
      ]);
      endIso = firstIsoFromCandidates([
        row.end_date,
        details?.end_date,
        details?.endDate,
        details?.departure_date,
        details?.departureDate,
        details?.return_date,
        details?.returnDate,
      ]);
    } else if (category === 'hotels') {
      startIso = firstIsoFromCandidates([
        row.start_date,
        details?.arrival_date,
        details?.arrivalDate,
        details?.check_in,
        details?.checkIn
      ]);
      endIso = firstIsoFromCandidates([
        row.end_date,
        details?.departure_date,
        details?.departureDate,
        details?.check_out,
        details?.checkOut,
      ]);
    } else if (category === 'transport') {
      startIso = firstIsoFromCandidates([
        transportBooking?.travel_date,
        details?.travel_date,
        details?.travelDate,
        row.start_date,
      ]);
      endIso = firstIsoFromCandidates([
        transportBooking?.return_travel_date,
        transportBooking?.travel_date,
        details?.return_travel_date,
        details?.returnTravelDate,
        details?.travel_date,
        details?.travelDate,
        row.end_date,
      ]);
    } else {
      startIso = firstIsoFromCandidates([
        details?.estimated_delivery_date,
        details?.estimatedDeliveryDate,
        details?.delivery_date,
        details?.deliveryDate
      ]);
      endIso = startIso;
    }

    if (!startIso && !endIso) return null;
    if (!startIso) startIso = endIso;
    if (!endIso) endIso = startIso;
    if (!startIso || !endIso) return null;

    if (startIso > endIso) {
      const tmp = startIso;
      startIso = endIso;
      endIso = tmp;
    }

    return { startIso, endIso };
  }

  function forEachIsoDateInRange(startIso, endIso, callback, maxDays = 160) {
    if (!startIso || !endIso || typeof callback !== 'function') return;
    const startMs = Date.parse(`${startIso}T00:00:00Z`);
    const endMs = Date.parse(`${endIso}T00:00:00Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
    if (endMs < startMs) return;
    const step = 86400000;
    const limit = Number.isFinite(maxDays) && maxDays > 0 ? Math.floor(maxDays) : 160;
    let emitted = 0;
    for (let ts = startMs; ts <= endMs && emitted < limit; ts += step) {
      callback(new Date(ts).toISOString().slice(0, 10));
      emitted += 1;
    }
  }

  function orderLabelForFulfillment(row) {
    if (!row) return '—';
    if (String(row.__source || '') === 'shop') {
      return row.order_number || String(row.order_id || row.id || '').slice(0, 8) || '—';
    }
    return row.reference || String(row.booking_id || row.id || '').slice(0, 8) || '—';
  }

  function orderPriceLabelForFulfillment(row) {
    if (!row) return '—';
    if (String(row.__source || '') === 'shop') {
      const allocated = Number(row.total_allocated);
      const subtotal = Number(row.subtotal);
      const value = Number.isFinite(allocated) ? allocated : (Number.isFinite(subtotal) ? subtotal : null);
      return value == null ? '—' : formatMoney(value, 'EUR');
    }
    if (String(row.resource_type || '').trim().toLowerCase() === 'cars') {
      const pricing = getCarsFulfillmentPricing(row);
      return formatMoney(pricing.amount, pricing.currency || row.currency || 'EUR');
    }
    return row.total_price == null ? '—' : formatMoney(row.total_price, row.currency || 'EUR');
  }

  function syncOrdersFilterUiFromState() {
    const active = normalizeOrdersStatus(state.orders.status);
    const buttons = Array.isArray(els.ordersStatusButtons) ? els.ordersStatusButtons : [];
    buttons.forEach((btn) => {
      const value = normalizeOrdersStatus(btn?.getAttribute('data-orders-status-filter') || '');
      const isActive = value === active;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (els.ordersFilterCurrent) {
      const currentLabel = active === 'all' ? 'All' : formatOrdersStatusLabel(active);
      setText(els.ordersFilterCurrent, currentLabel || 'All');
    }
  }

  function syncOrdersFilterCollapseUi() {
    const expanded = Boolean(state.orders.filterExpanded);
    const toggleLabel = expanded ? 'Tap to collapse' : 'Tap to expand';
    if (els.btnOrdersFilterToggle) {
      els.btnOrdersFilterToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      els.btnOrdersFilterToggle.title = `${toggleLabel} order filter`;
    }
    if (els.ordersFilterToggleState) {
      setText(els.ordersFilterToggleState, toggleLabel);
    }
    setHidden(els.ordersFilterBody, !expanded);
  }

  function syncOrdersCalendarCollapseUi() {
    const expanded = Boolean(state.orders.calendarExpanded);
    const toggleLabel = expanded ? 'Tap to collapse' : 'Tap to expand';
    if (els.btnOrdersCalendarToggle) {
      els.btnOrdersCalendarToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      els.btnOrdersCalendarToggle.title = `${toggleLabel} paid reservations calendar`;
    }
    if (els.ordersCalendarToggleState) {
      setText(els.ordersCalendarToggleState, toggleLabel);
    }
    setHidden(els.ordersCalendarBody, !expanded);
  }

  function applyOrdersTableDensity() {
    const compact = Boolean(state.orders.compactRows);
    if (els.fulfillmentsTableContainer) {
      els.fulfillmentsTableContainer.classList.toggle('partner-fulfillments-table--compact', compact);
    }
    if (els.btnOrdersToggleCompact) {
      els.btnOrdersToggleCompact.classList.toggle('is-active', compact);
      els.btnOrdersToggleCompact.setAttribute('aria-pressed', compact ? 'true' : 'false');
      els.btnOrdersToggleCompact.textContent = compact ? 'Compact rows: On' : 'Compact rows: Off';
    }
  }

  function filteredFulfillmentsForOrdersPanel() {
    const rows = filteredFulfillmentsForSelectedCategory();
    const statusFilter = normalizeOrdersStatus(state.orders.status);

    return rows.filter((row) => {
      const status = fulfillmentStatusForOrders(row);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }

  function setOrdersCalendarMonthInput(value) {
    const next = normalizeMonthValue(value, getMonthValue());
    state.orders.monthValue = next;
    if (els.ordersCalendarMonthInput) {
      els.ordersCalendarMonthInput.value = next;
    }
  }

  function ensureOrdersCalendarMonthInput() {
    const fromState = normalizeMonthValue(state.orders.monthValue, '');
    if (fromState) {
      setOrdersCalendarMonthInput(fromState);
      return;
    }
    const fromInput = normalizeMonthValue(els.ordersCalendarMonthInput?.value, '');
    if (fromInput) {
      setOrdersCalendarMonthInput(fromInput);
      return;
    }
    setOrdersCalendarMonthInput(getMonthValue());
  }

  function renderOrdersDayList(dayIso, rowsForDay) {
    if (!els.ordersCalendarList) return;
    const list = Array.isArray(rowsForDay) ? rowsForDay : [];
    const heading = dayIso ? formatDateDmy(dayIso) : 'Select a day';

    if (!list.length) {
      setHtml(
        els.ordersCalendarList,
        `
          <div class="small"><strong>${escapeHtml(heading)}</strong></div>
          <div class="muted small">No paid reservations for this day.</div>
        `
      );
      return;
    }

    const sorted = list.slice().sort((a, b) => {
      const aMs = Date.parse(String(a?.created_at || '')) || 0;
      const bMs = Date.parse(String(b?.created_at || '')) || 0;
      return bMs - aMs;
    });

    setHtml(
      els.ordersCalendarList,
      `
        <div class="small"><strong>${escapeHtml(heading)}</strong> · ${sorted.length} order(s)</div>
        ${sorted.map((row) => {
          const id = String(row?.id || '').trim();
          const label = orderLabelForFulfillment(row);
          const category = categoryLabel(fulfillmentCategoryForOrders(row) || 'all');
          const status = formatOrdersStatusLabel(fulfillmentStatusForOrders(row));
          const price = orderPriceLabelForFulfillment(row);
          const paid = isFulfillmentPaidForOrders(row) ? 'Payment completed' : 'Unpaid';
          const range = fulfillmentScheduleRange(row);
          const rangeLabel = range?.startIso && range?.endIso
            ? `${formatDateDmy(range.startIso)} -> ${formatDateDmy(range.endIso)}`
            : 'Not set';
          return `
            <div class="partner-orders-day-list__item">
              <div>
                <p class="partner-orders-day-list__name">${escapeHtml(label)}</p>
                <div class="partner-orders-day-list__meta">${escapeHtml(category)} · ${escapeHtml(status)} · ${escapeHtml(paid)}</div>
                <div class="partner-orders-day-list__meta">Dates: ${escapeHtml(rangeLabel)}</div>
              </div>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
                <div class="partner-orders-day-list__price">${escapeHtml(price)}</div>
                <button type="button" class="btn-sm" data-focus-fulfillment="${escapeHtml(id)}">Show in table</button>
              </div>
            </div>
          `;
        }).join('')}
      `
    );

    els.ordersCalendarList.querySelectorAll('button[data-focus-fulfillment]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fid = String(btn.getAttribute('data-focus-fulfillment') || '').trim();
        if (!fid || !els.fulfillmentsBody) return;
        const row = Array.from(els.fulfillmentsBody.querySelectorAll('tr[data-fulfillment-id]'))
          .find((tr) => String(tr.getAttribute('data-fulfillment-id') || '').trim() === fid);
        if (!row) return;
        clearFulfillmentHighlights();
        row.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.55)';
        row.style.background = 'rgba(37, 99, 235, 0.08)';
        try {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_e) {
          try {
            row.scrollIntoView(true);
          } catch (_e2) {}
        }
        setTimeout(() => {
          if (!row.isConnected) return;
          row.style.boxShadow = '';
          row.style.background = '';
        }, 4500);
      });
    });
  }

  function renderOrdersScheduleCalendar(filteredRows) {
    if (!els.ordersCalendarGrid || !els.ordersCalendarList) return;

    ensureOrdersCalendarMonthInput();
    const monthValue = String(state.orders.monthValue || getMonthValue()).trim() || getMonthValue();
    const { start, startIso, endIso } = monthToStartEnd(monthValue);
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayMap = {};

    const rows = Array.isArray(filteredRows) ? filteredRows : filteredFulfillmentsForOrdersPanel();
    const paidRows = rows.filter((row) => isFulfillmentPaidForOrders(row));
    paidRows.forEach((row) => {
      const range = fulfillmentScheduleRange(row);
      if (!range?.startIso || !range?.endIso) return;
      forEachIsoDateInRange(range.startIso, range.endIso, (dayIso) => {
        if (dayIso < startIso || dayIso > endIso) return;
        if (!dayMap[dayIso]) dayMap[dayIso] = [];
        dayMap[dayIso].push(row);
      });
    });

    const todayIso = localDateIso();
    const todayInMonth = todayIso >= startIso && todayIso <= endIso;
    const firstWeekdayMon = (start.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0).getDate();

    if (!state.orders.selectedDateIso || state.orders.selectedDateIso < startIso || state.orders.selectedDateIso > endIso) {
      state.orders.selectedDateIso = todayInMonth ? todayIso : `${monthValue}-01`;
    }

    let html = weekLabels.map((label) => `<div class="partner-orders-calendar-weekday">${escapeHtml(label)}</div>`).join('');
    for (let i = 0; i < firstWeekdayMon; i += 1) {
      html += '<div class="partner-orders-calendar-day partner-orders-calendar-day--blank" aria-hidden="true"></div>';
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayIso = `${monthValue}-${String(day).padStart(2, '0')}`;
      const rowsForDay = dayMap[dayIso] || [];
      const bookedCount = rowsForDay.length;
      const isSelected = dayIso === state.orders.selectedDateIso;
      const classes = [
        'partner-orders-calendar-day',
        dayIso === todayIso ? 'partner-orders-calendar-day--today' : '',
        isSelected ? 'partner-orders-calendar-day--selected' : '',
        bookedCount > 0 ? 'partner-orders-calendar-day--has-booked' : '',
      ].filter(Boolean).join(' ');
      const counts = bookedCount > 0
        ? `<span class="partner-orders-calendar-badge" title="Paid reservation days">${bookedCount}</span>`
        : '';

      html += `
        <button
          type="button"
          class="${escapeHtml(classes)}"
          data-orders-calendar-day="${escapeHtml(dayIso)}"
          title="${escapeHtml(`${formatDateDmy(dayIso)}${bookedCount > 0 ? ` · ${bookedCount} paid reservation day(s)` : ''}`)}"
        >
          <div class="partner-orders-calendar-daynum">${day}</div>
          <div class="partner-orders-calendar-counts">${counts}</div>
        </button>
      `;
    }

    setHtml(els.ordersCalendarGrid, html);
    if (!state.orders.dayListVisible) {
      setHidden(els.ordersCalendarList, true);
      if (els.ordersDayListHint) {
        setText(els.ordersDayListHint, 'Tap a day to show matching paid orders.');
      }
    } else {
      setHidden(els.ordersCalendarList, false);
      renderOrdersDayList(state.orders.selectedDateIso, dayMap[state.orders.selectedDateIso] || []);
      if (els.ordersDayListHint) {
        const label = state.orders.selectedDateIso ? formatDateDmy(state.orders.selectedDateIso) : 'selected day';
        setText(els.ordersDayListHint, `Showing matching paid orders for ${label}.`);
      }
    }

    els.ordersCalendarGrid.querySelectorAll('[data-orders-calendar-day]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dayIso = String(btn.getAttribute('data-orders-calendar-day') || '').trim();
        if (!dayIso) return;
        state.orders.selectedDateIso = dayIso;
        state.orders.dayListVisible = true;
        renderOrdersScheduleCalendar(filteredFulfillmentsForOrdersPanel());
      });
    });
  }

  function showTabOnly(tab) {
    const isFulfillments = tab === 'fulfillments';
    els.tabBtnFulfillments?.classList.toggle('is-active', isFulfillments);
    els.tabBtnCalendar?.classList.toggle('is-active', !isFulfillments);
    setHidden(els.tabFulfillments, !isFulfillments);
    setHidden(els.tabCalendar, isFulfillments);
  }

  function partnerCanAccessAnalytics() {
    const { canShop, canCars, canTrips, canHotels, canTransport } = getSelectedPartnerCapabilities();
    return Boolean(canShop || canCars || canTrips || canHotels || canTransport);
  }

  function updateSidebarCategoryVisibility() {
    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const hasShopFulfillments = (state.fulfillments || []).some((f) => f && String(f.__source || '') === 'shop');
    const canShop = Boolean(partner?.can_manage_shop && (partner?.shop_vendor_id || hasShopFulfillments));
    const canCars = Boolean(partner?.can_manage_cars);
    const canTrips = Boolean(partner?.can_manage_trips);
    const canHotels = Boolean(partner?.can_manage_hotels);
    const canBlog = Boolean(partner?.can_manage_blog);
    const canTransport = Boolean(partner?.can_manage_transport);
    const canAnalytics = Boolean(canShop || canCars || canTrips || canHotels || canTransport);

    const { isAffiliateOnly } = getSelectedPartnerCapabilities();
    if (isAffiliateOnly) {
      setHidden(els.partnerNavShop, true);
      setHidden(els.partnerNavCars, true);
      setHidden(els.partnerNavTrips, true);
      setHidden(els.partnerNavHotels, true);
      setHidden(els.partnerNavBlog, true);
      setHidden(els.partnerNavTransport, true);
      setHidden(els.partnerNavAnalytics, true);
      setHidden(els.partnerAnalyticsTopProductsCard, true);
      if (String(state.selectedCategory || 'all') !== 'all') {
        state.selectedCategory = 'all';
      }
      if (els.partnerAnalyticsView && !els.partnerAnalyticsView.hidden) {
        setMainView('portal');
      }
      syncAnalyticsCategoryOptions();
      updateServiceSectionVisibility();
      updateAnalyticsCardVisibility();
      updateAffiliateSummaryCardVisibility();
      return;
    }

    setHidden(els.partnerNavShop, !canShop);
    setHidden(els.partnerNavCars, !canCars);
    setHidden(els.partnerNavTrips, !canTrips);
    setHidden(els.partnerNavHotels, !canHotels);
    setHidden(els.partnerNavBlog, !canBlog);
    setHidden(els.partnerNavTransport, !canTransport);
    setHidden(els.partnerNavAnalytics, !canAnalytics);
    setHidden(els.partnerAnalyticsTopProductsCard, !canShop);
    if (!canAnalytics && els.partnerAnalyticsView && !els.partnerAnalyticsView.hidden) {
      setMainView('portal');
    }
    if (!canBlog && els.partnerBlogView && !els.partnerBlogView.hidden) {
      setMainView('portal');
    }

    const allowed = new Set(['all', 'shop', 'cars', 'trips', 'hotels', 'transport']);
    if (!canShop) allowed.delete('shop');
    if (!canCars) allowed.delete('cars');
    if (!canTrips) allowed.delete('trips');
    if (!canHotels) allowed.delete('hotels');
    if (!canTransport) allowed.delete('transport');

    if (!allowed.has(String(state.selectedCategory || 'all'))) {
      state.selectedCategory = 'all';
    }

    syncAnalyticsCategoryOptions();
    updateServiceSectionVisibility();
    updateAnalyticsCardVisibility();
    updateAffiliateSummaryCardVisibility();
  }

  function navToCategory(category) {
    const next = category || 'all';
    state.selectedCategory = next;
    state.orders.selectedDateIso = localDateIso();

    updateSidebarCategoryVisibility();
    updateAnalyticsCardVisibility();
    updateAffiliateSummaryCardVisibility();
    updateServiceSectionVisibility();

    setMainView('portal');

    const btnFor = (cat) => {
      if (cat === 'all') return els.partnerNavAll;
      if (cat === 'shop') return els.partnerNavShop;
      if (cat === 'cars') return els.partnerNavCars;
      if (cat === 'trips') return els.partnerNavTrips;
      if (cat === 'hotels') return els.partnerNavHotels;
      if (cat === 'transport') return els.partnerNavTransport;
      return els.partnerNavAll;
    };
    setSidebarActive(btnFor(next));

    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = `Partner Portal — ${categoryLabel(next)}`;
    }

    showTabOnly('fulfillments');
    try {
      refreshAffiliateSummaryCard();
    } catch (_e) {
    }
    if (!state.fulfillments?.length) {
      refreshFulfillments();
    } else {
      refreshOrdersPanelViews();
      startAnalyticsRealtime();
      refreshPortalResponseInsights();
    }
    closeSidebar();
  }

  async function navToBlog() {
    const { canBlog } = getSelectedPartnerCapabilities();
    if (!canBlog) {
      showToast('Blog access is not enabled for this partner.', 'info');
      return;
    }
    setMainView('blog');
    setSidebarActive(els.partnerNavBlog);
    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = 'Partner Portal — Blog';
    }
    await refreshPartnerBlogView();
    closeSidebar();
  }

  async function navToReferrals() {
    if (!state.session || !state.user) {
      showToast('Please log in to view referrals.', 'error');
      openAuthModal('login');
      return;
    }

    referralTreeQuery = '';
    if (els.partnerReferralTreeSearch) {
      els.partnerReferralTreeSearch.value = '';
    }

    setMainView('referrals');
    setSidebarActive(els.partnerNavReferrals);

    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = 'Partner Portal — Referrals';
    }

    await refreshReferralWidget();

    try {
      await refreshAffiliatePanel();
    } catch (e) {
      console.error(e);
    }

    try {
      await refreshReferralOrdersPanel();
    } catch (e) {
      console.error(e);
    }

    try {
      await refreshReferralStatsAndTree();
    } catch (e) {
      console.error(e);
    }
    closeSidebar();
  }

  function partnerLinksTypeLabel(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'cars') return 'Cars';
    if (normalized === 'trips') return 'Trips';
    if (normalized === 'hotels') return 'Hotels';
    if (normalized === 'transport') return 'Transport';
    if (normalized === 'shop') return 'Shop';
    if (normalized === 'blog') return 'Blog';
    return 'Service';
  }

  function getPartnerUiLanguage() {
    const lang = String(
      (typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : '')
      || window.appI18n?.language
      || 'en'
    ).trim().toLowerCase();
    return lang.startsWith('pl') ? 'pl' : 'en';
  }

  function normalizePreviewText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') return localizedLabelFromValue(value, 'en');
    return '';
  }

  function formatPartnerShortDate(value) {
    const iso = String(value || '').trim();
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatPartnerMoneyCompact(value, currency = 'EUR') {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return '';
    const code = String(currency || 'EUR').trim().toUpperCase() || 'EUR';
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (_error) {
      return `${amount.toFixed(amount % 1 === 0 ? 0 : 2)} ${code}`;
    }
  }

  function getPartnerLinksDisplayUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const viewer = window.CE_MEDIA_VIEWER;
    if (viewer?.getDisplayUrl) {
      try {
        return String(viewer.getDisplayUrl(raw) || raw).trim();
      } catch (_error) {
        return raw;
      }
    }
    return raw;
  }

  function collectMediaUrls(value, depth = 0) {
    if (depth > 4 || value == null) return [];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((entry) => collectMediaUrls(entry, depth + 1));
    }
    if (typeof value === 'object') {
      const direct = [
        value.url,
        value.src,
        value.publicUrl,
        value.public_url,
        value.image_url,
        value.photo_url,
        value.thumbnail_url,
        value.cover_image_url,
        value.main_image_url,
      ].flatMap((entry) => collectMediaUrls(entry, depth + 1));

      const nested = [
        value.photos,
        value.gallery,
        value.gallery_photos,
        value.images,
        value.media,
        value.items,
      ].flatMap((entry) => collectMediaUrls(entry, depth + 1));

      return [...direct, ...nested];
    }
    return [];
  }

  function getFirstMediaUrl(value) {
    const seen = new Set();
    for (const candidate of collectMediaUrls(value)) {
      const normalized = String(candidate || '').trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      return getPartnerLinksDisplayUrl(normalized);
    }
    return '';
  }

  function getHotelPreviewImageUrl(row) {
    const roomTypeMedia = Array.isArray(row?.room_types)
      ? row.room_types.flatMap((roomType) => collectMediaUrls([
        roomType?.cover_image_url,
        roomType?.gallery_photos,
        roomType?.photos,
      ]))
      : [];
    return getFirstMediaUrl([
      row?.cover_image_url,
      row?.main_image_url,
      row?.thumbnail_url,
      row?.image_url,
      row?.photos,
      row?.gallery_photos,
      row?.gallery,
      row?.media,
      roomTypeMedia,
    ]);
  }

  function normalizePartnerLinksTextMap(value, fallback = '') {
    const direct = String(fallback || '').trim();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        pl: String(value.pl || value.en || direct).trim(),
        en: String(value.en || value.pl || direct).trim(),
      };
    }
    const normalized = String(value || direct).trim();
    return { pl: normalized, en: normalized };
  }

  function getPartnerLinksLocalizedText(item, field, preferred = 'en', fallbackField = '') {
    const key = `${field}ByLang`;
    const pack = item && typeof item === 'object' ? item[key] : null;
    const fallbackValue = fallbackField && item && typeof item === 'object'
      ? String(item[fallbackField] || '').trim()
      : '';
    if (pack && typeof pack === 'object') {
      const lang = String(preferred || 'en').trim().toLowerCase() === 'pl' ? 'pl' : 'en';
      return String(pack[lang] || pack.en || pack.pl || fallbackValue).trim();
    }
    return fallbackValue;
  }

  function getPartnerLinksTypeSortOrder(type) {
    const order = PARTNER_LINKS_FILTERS.findIndex((entry) => entry.key === type);
    return order >= 0 ? order : 999;
  }

  function getCarReadableSlug(item) {
    const raw = getPartnerLinksLocalizedText(item, 'title', 'en', 'title')
      || getPartnerLinksLocalizedText(item, 'title', 'pl', 'title')
      || String(item?.title || '').trim();
    return slugifyText(raw || 'car-offer');
  }

  function buildPartnerLinksPageUrl(item, options = {}) {
    const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : 'https://cypruseye.com';
    const url = new URL('/', baseUrl);
    const type = String(item?.type || '').trim().toLowerCase();
    const language = String(options.lang || 'en').trim().toLowerCase() === 'pl' ? 'pl' : 'en';
    const kind = String(options.kind || 'detail').trim().toLowerCase() === 'landing' ? 'landing' : 'detail';

    if (type === 'trips') {
      url.pathname = kind === 'landing' ? '/trips.html' : '/trip.html';
      const slug = String(item?.slugByLang?.[language] || item?.slugByLang?.en || item?.slugByLang?.pl || item?.slug || '').trim();
      if (kind === 'detail' && slug) url.searchParams.set('slug', slug);
      url.searchParams.set('lang', language);
      return url.toString();
    }
    if (type === 'hotels') {
      url.pathname = kind === 'landing' ? '/hotels.html' : '/hotel.html';
      const slug = String(item?.slugByLang?.[language] || item?.slugByLang?.en || item?.slugByLang?.pl || item?.slug || '').trim();
      if (kind === 'detail' && slug) url.searchParams.set('slug', slug);
      url.searchParams.set('lang', language);
      return url.toString();
    }
    if (type === 'cars') {
      url.pathname = '/car.html';
      if (kind === 'detail' && item?.resourceId) {
        url.searchParams.set('offer_id', item.resourceId);
        url.searchParams.set('car', getCarReadableSlug(item));
      }
      if (kind === 'detail' && item?.offerLocation) url.searchParams.set('offer_location', item.offerLocation);
      url.searchParams.set('lang', language);
      return url.toString();
    }
    if (type === 'transport') {
      url.pathname = '/transport.html';
      if (kind === 'detail' && item?.resourceId) url.searchParams.set('route_id', item.resourceId);
      url.searchParams.set('lang', language);
      return url.toString();
    }
    if (type === 'shop') {
      url.pathname = '/shop.html';
      if (kind === 'detail' && item?.resourceId) url.searchParams.set('product', item.resourceId);
      url.searchParams.set('lang', language);
      return url.toString();
    }
    if (type === 'blog') {
      if (kind === 'landing') {
        url.pathname = '/blog';
        url.searchParams.set('lang', language);
        return url.toString();
      }
      const slug = String(item?.slugByLang?.[language] || item?.slugByLang?.en || item?.slugByLang?.pl || '').trim();
      if (!slug) {
        url.pathname = '/blog';
        url.searchParams.set('lang', language);
        return url.toString();
      }
      url.pathname = `/blog/${encodeURIComponent(slug)}`;
      url.searchParams.set('lang', language);
      return url.toString();
    }
    return `${baseUrl}/`;
  }

  function buildPartnerLinksReferralUrl(item, options = {}) {
    const code = getProfileReferralCode(state.profile);
    const baseUrl = buildPartnerLinksPageUrl(item, options);
    if (!code) return baseUrl;
    return buildReferralLink(code, baseUrl) || baseUrl;
  }

  function getPartnerLinksFallbackDescription(type) {
    if (type === 'blog') return 'Share this article with your referral code attached.';
    if (type === 'transport') return 'Share this route with your referral code attached.';
    return 'Use this direct link to send the selected service with your referral code attached.';
  }

  function summarizePartnerDiscountStatus(row) {
    const rawStatus = String(row?.status || '').trim().toLowerCase();
    const isActiveFlag = row?.is_active !== false;
    const now = Date.now();
    const startsAt = row?.starts_at ? new Date(row.starts_at).getTime() : 0;
    const expiresAt = row?.expires_at ? new Date(row.expires_at).getTime() : 0;

    if (expiresAt && Number.isFinite(expiresAt) && expiresAt < now) {
      return { key: 'expired', label: 'Expired' };
    }
    if (isActiveFlag && rawStatus === 'active' && startsAt && Number.isFinite(startsAt) && startsAt > now) {
      return { key: 'scheduled', label: 'Scheduled' };
    }
    if (isActiveFlag && (rawStatus === 'active' || !rawStatus)) {
      return { key: 'active', label: 'Active' };
    }
    if (rawStatus === 'draft' || rawStatus === 'pending') {
      return { key: 'draft', label: rawStatus === 'pending' ? 'Pending' : 'Draft' };
    }
    return { key: 'inactive', label: 'Inactive' };
  }

  function formatPartnerDiscountValidity(row) {
    const parts = [];
    const startsAt = formatPartnerShortDate(row?.starts_at);
    const expiresAt = formatPartnerShortDate(row?.expires_at);
    if (startsAt) parts.push(`From ${startsAt}`);
    if (expiresAt) parts.push(`Until ${expiresAt}`);
    return parts.join(' · ');
  }

  function normalizePartnerLinksItem(type, row, extra = {}) {
    const normalizedType = String(type || '').trim().toLowerCase();
    const resourceId = String(row?.id || '').trim();
    if (!resourceId) return null;

    if (normalizedType === 'trips') {
      const titleByLang = normalizePartnerLinksTextMap(row?.title, String(row?.title_en || row?.title_pl || row?.slug || resourceId).trim());
      const descriptionByLang = normalizePartnerLinksTextMap(row?.short_description || row?.description);
      const slug = String(row?.slug || '').trim();
      return {
        key: `trips:${resourceId}`,
        type: 'trips',
        resourceId,
        slug,
        slugByLang: { pl: slug, en: slug },
        title: titleByLang.en || titleByLang.pl,
        titleByLang,
        meta: String(row?.start_city || '').trim(),
        description: descriptionByLang.en || descriptionByLang.pl,
        descriptionByLang,
        imageUrl: getFirstMediaUrl([row?.main_image_url, row?.cover_image_url, row?.image_url, row?.photos]),
      };
    }

    if (normalizedType === 'hotels') {
      const titleByLang = normalizePartnerLinksTextMap(row?.title, String(row?.title_en || row?.title_pl || row?.slug || resourceId).trim());
      const descriptionByLang = normalizePartnerLinksTextMap(row?.summary || row?.description || row?.short_description);
      const slug = String(row?.slug || '').trim();
      return {
        key: `hotels:${resourceId}`,
        type: 'hotels',
        resourceId,
        slug,
        slugByLang: { pl: slug, en: slug },
        title: titleByLang.en || titleByLang.pl,
        titleByLang,
        meta: String(row?.city || row?.country || '').trim(),
        description: descriptionByLang.en || descriptionByLang.pl,
        descriptionByLang,
        imageUrl: getHotelPreviewImageUrl(row),
      };
    }

    if (normalizedType === 'cars') {
      const title = normalizeTitleJson(row?.car_model) || normalizeTitleJson(row?.car_type) || String(row?.name || resourceId).trim();
      const location = String(row?.location || '').trim();
      const priceFrom = Number(row?.price_per_day || row?.price_10plus_days || row?.price_7_10days || row?.price_4_6days || 0);
      return {
        key: `cars:${resourceId}`,
        type: 'cars',
        resourceId,
        title,
        titleByLang: { pl: title, en: title },
        meta: [location, priceFrom > 0 ? `from ${formatPartnerMoneyCompact(priceFrom, 'EUR')}` : ''].filter(Boolean).join(' · '),
        description: normalizePreviewText(row?.description),
        descriptionByLang: normalizePartnerLinksTextMap(row?.description),
        imageUrl: getFirstMediaUrl([row?.image_url, row?.images, row?.photos]),
        offerLocation: location.toLowerCase(),
      };
    }

    if (normalizedType === 'transport') {
      const routeLabel = extra.routeLabel || `Route ${resourceId.slice(0, 8)}`;
      const currency = String(row?.currency || 'EUR').trim().toUpperCase() || 'EUR';
      const prices = [Number(row?.day_price || 0), Number(row?.night_price || 0)].filter((value) => Number.isFinite(value) && value > 0);
      const fromPrice = prices.length ? Math.min(...prices) : 0;
      const capacityBits = [
        Number(row?.included_passengers || 0) > 0 ? `${row.included_passengers} pax` : '',
        Number(row?.included_bags || 0) > 0 ? `${row.included_bags} bags` : '',
      ].filter(Boolean);
      return {
        key: `transport:${resourceId}`,
        type: 'transport',
        resourceId,
        title: routeLabel,
        titleByLang: { pl: routeLabel, en: routeLabel },
        meta: fromPrice > 0 ? `from ${formatPartnerMoneyCompact(fromPrice, currency)}` : String(extra.routeMeta || currency).trim(),
        description: capacityBits.join(' · ') || normalizePreviewText(extra.description || ''),
        descriptionByLang: normalizePartnerLinksTextMap(capacityBits.join(' · ') || normalizePreviewText(extra.description || '')),
        imageUrl: '',
        transportFromPrice: fromPrice > 0 ? formatPartnerMoneyCompact(fromPrice, currency) : '',
        transportNote: capacityBits.join(' · ') || `Currency: ${currency}`,
      };
    }

    if (normalizedType === 'shop') {
      const titleByLang = {
        pl: String(row?.name || row?.name_en || row?.slug || resourceId).trim(),
        en: String(row?.name_en || row?.name || row?.slug || resourceId).trim(),
      };
      const descriptionByLang = {
        pl: normalizePreviewText(row?.short_description || row?.description || row?.short_description_en || row?.description_en),
        en: normalizePreviewText(row?.short_description_en || row?.description_en || row?.short_description || row?.description),
      };
      return {
        key: `shop:${resourceId}`,
        type: 'shop',
        resourceId,
        title: titleByLang.en || titleByLang.pl,
        titleByLang,
        meta: row?.price != null ? formatPartnerMoneyCompact(row.price, 'EUR') : '',
        description: descriptionByLang.en || descriptionByLang.pl,
        descriptionByLang,
        imageUrl: getFirstMediaUrl([row?.thumbnail_url, row?.images]),
      };
    }

    if (normalizedType === 'blog') {
      const translations = Array.isArray(row?.translations) ? row.translations : [];
      const byLang = { pl: null, en: null };
      translations.forEach((translation) => {
        const lang = String(translation?.lang || '').trim().toLowerCase();
        if (lang === 'pl' || lang === 'en') {
          byLang[lang] = translation;
        }
      });
      const titlePl = String(byLang.pl?.title || byLang.en?.title || '').trim();
      const titleEn = String(byLang.en?.title || byLang.pl?.title || '').trim();
      const summaryPl = String(byLang.pl?.summary || byLang.pl?.lead || byLang.en?.summary || byLang.en?.lead || '').trim();
      const summaryEn = String(byLang.en?.summary || byLang.en?.lead || byLang.pl?.summary || byLang.pl?.lead || '').trim();
      const slugPl = String(byLang.pl?.slug || byLang.en?.slug || '').trim();
      const slugEn = String(byLang.en?.slug || byLang.pl?.slug || '').trim();
      return {
        key: `blog:${resourceId}`,
        type: 'blog',
        resourceId,
        title: titleEn || titlePl || `Blog post ${resourceId.slice(0, 8)}`,
        titleByLang: {
          pl: titlePl || titleEn,
          en: titleEn || titlePl,
        },
        meta: formatPartnerShortDate(row?.published_at) || 'Published',
        description: summaryEn || summaryPl,
        descriptionByLang: {
          pl: summaryPl || summaryEn,
          en: summaryEn || summaryPl,
        },
        imageUrl: getFirstMediaUrl(row?.cover_image_url),
        slugByLang: {
          pl: slugPl,
          en: slugEn,
        },
      };
    }

    return null;
  }

  function getFilteredPartnerLinksItems() {
    const filter = String(state.linksDiscounts.filter || 'all').trim().toLowerCase();
    const rows = Array.isArray(state.linksDiscounts.items) ? state.linksDiscounts.items : [];
    if (filter === 'all') return rows;
    return rows.filter((item) => String(item?.type || '').trim().toLowerCase() === filter);
  }

  function getPartnerLinksSelectedItem() {
    const key = String(state.linksDiscounts.selectedKey || '').trim();
    if (!key) return null;
    return (state.linksDiscounts.items || []).find((item) => item?.key === key) || null;
  }

  function ensurePartnerLinksSelectedItem() {
    const filtered = getFilteredPartnerLinksItems();
    if (!filtered.length) {
      state.linksDiscounts.selectedKey = '';
      return null;
    }
    const current = filtered.find((item) => item.key === state.linksDiscounts.selectedKey) || null;
    if (current) return current;
    state.linksDiscounts.selectedKey = filtered[0].key;
    return filtered[0];
  }

  function renderPartnerLinksViewTabs() {
    if (!els.partnerLinksViewTabs) return;
    const servicesCount = Array.isArray(state.linksDiscounts.items) ? state.linksDiscounts.items.length : 0;
    const discountCount = Array.isArray(state.linksDiscounts.discountCodes) ? state.linksDiscounts.discountCodes.length : 0;
    els.partnerLinksViewTabs.innerHTML = `
      <button
        type="button"
        class="partner-tab ${state.linksDiscounts.view === 'services' ? 'is-active' : ''}"
        data-partner-links-view="services"
      >
        Service links
        <span class="partner-links-tab-count">${escapeHtml(String(servicesCount))}</span>
      </button>
      <button
        type="button"
        class="partner-tab ${state.linksDiscounts.view === 'discounts' ? 'is-active' : ''}"
        data-partner-links-view="discounts"
      >
        Discounts
        <span class="partner-links-tab-count">${escapeHtml(String(discountCount))}</span>
      </button>
    `;
  }

  function syncPartnerLinksViewPanels() {
    setHidden(els.partnerLinksServicesPanel, state.linksDiscounts.view !== 'services');
    setHidden(els.partnerLinksDiscountsPanel, state.linksDiscounts.view !== 'discounts');
  }

  function formatPartnerDiscountScope(row) {
    const type = String(row?.type || '').trim().toLowerCase();
    if (type === 'cars') {
      const parts = [];
      const locations = Array.isArray(row?.applicable_locations) ? row.applicable_locations.filter(Boolean) : [];
      const models = Array.isArray(row?.applicable_car_models) ? row.applicable_car_models.filter(Boolean) : [];
      const offerIds = Array.isArray(row?.applicable_offer_ids) ? row.applicable_offer_ids.filter(Boolean) : [];
      if (locations.length) parts.push(`Locations: ${locations.join(', ')}`);
      if (models.length) parts.push(`Models: ${models.join(', ')}`);
      if (offerIds.length) parts.push(`Offers: ${offerIds.length}`);
      return parts.join(' · ') || 'Cars';
    }
    if (type === 'shop') {
      const parts = [];
      const productCount = Array.isArray(row?.applicable_product_ids) ? row.applicable_product_ids.filter(Boolean).length : 0;
      const categoryCount = Array.isArray(row?.applicable_category_ids) ? row.applicable_category_ids.filter(Boolean).length : 0;
      const vendorCount = Array.isArray(row?.applicable_vendor_ids) ? row.applicable_vendor_ids.filter(Boolean).length : 0;
      if (productCount) parts.push(`Products: ${productCount}`);
      if (categoryCount) parts.push(`Categories: ${categoryCount}`);
      if (vendorCount) parts.push(`Vendors: ${vendorCount}`);
      return parts.join(' · ') || 'Shop';
    }
    return partnerLinksTypeLabel(row?.service_type || row?.type);
  }

  function renderPartnerLinksFilters() {
    if (!els.partnerLinksFilters) return;
    els.partnerLinksFilters.innerHTML = PARTNER_LINKS_FILTERS.map((filter) => `
      <button
        type="button"
        class="partner-tab ${String(state.linksDiscounts.filter || 'all') === filter.key ? 'is-active' : ''}"
        data-partner-links-filter="${escapeHtml(filter.key)}"
      >${escapeHtml(filter.label)}</button>
    `).join('');
  }

  function renderPartnerLinksGrid() {
    if (!els.partnerLinksGrid) return;
    const filtered = getFilteredPartnerLinksItems();
    const uiLanguage = getPartnerUiLanguage();
    if (!filtered.length) {
      els.partnerLinksGrid.innerHTML = '<div class="partner-links-empty">No services available for this filter.</div>';
      return;
    }

    els.partnerLinksGrid.innerHTML = filtered.map((item) => {
      const title = getPartnerLinksLocalizedText(item, 'title', uiLanguage, 'title') || item.title;
      const description = getPartnerLinksLocalizedText(item, 'description', uiLanguage, 'description') || '';
      const summaryText = description || (item.type === 'transport' ? (item.transportNote || '') : '');
      const offerPl = buildPartnerLinksReferralUrl(item, { lang: 'pl', kind: 'detail' });
      const offerEn = buildPartnerLinksReferralUrl(item, { lang: 'en', kind: 'detail' });
      const imageHtml = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(title || item.title)}" loading="lazy" />`
        : (item.type === 'transport' && item.transportFromPrice
          ? `<div class="partner-links-card__placeholder"><span class="partner-links-card__transport-price">${escapeHtml(`from ${item.transportFromPrice}`)}</span><small>Transport route</small></div>`
          : `<div class="partner-links-card__placeholder">${escapeHtml(partnerLinksTypeLabel(item.type))}</div>`);
      return `
        <article
          class="partner-links-card partner-links-card--${escapeHtml(item.type)} ${item.key === state.linksDiscounts.selectedKey ? 'is-active' : ''}"
          data-partner-link-card="${escapeHtml(item.key)}"
          data-partner-link-preview="${escapeHtml(item.key)}"
          role="button"
          tabindex="0"
          aria-label="${escapeHtml(`Preview ${title}`)}"
        >
          <div class="partner-links-card__media">${imageHtml}</div>
          <div class="partner-links-card__body">
            <div class="partner-links-card__top">
              <span class="partner-links-card__category">${escapeHtml(partnerLinksTypeLabel(item.type))}</span>
              <button
                type="button"
                class="partner-links-info-btn"
                data-partner-link-preview="${escapeHtml(item.key)}"
                data-partner-link-stop="1"
                aria-label="${escapeHtml(`Preview ${title}`)}"
                title="Preview"
              >ℹ️</button>
            </div>
            <h3>${escapeHtml(title)}</h3>
            <p class="partner-links-card__meta">${escapeHtml(item.meta || '—')}</p>
            <p class="partner-links-card__summary ${summaryText ? '' : 'is-empty'}">${summaryText ? escapeHtml(summaryText) : '&nbsp;'}</p>
            <div class="partner-links-card__actions">
              <button type="button" class="btn-sm partner-links-action" data-partner-link-copy-url="${escapeHtml(offerPl)}" data-partner-link-stop="1">Copy PL 🇵🇱</button>
              <button type="button" class="btn-sm partner-links-action partner-links-action--primary" data-partner-link-copy-url="${escapeHtml(offerEn)}" data-partner-link-stop="1">Copy EN 🇬🇧</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function openPartnerLinksPreview(itemKey) {
    const key = String(itemKey || '').trim();
    if (!key || !els.partnerLinksPreviewModal) return;
    state.linksDiscounts.selectedKey = key;
    renderPartnerLinksGrid();
    renderPartnerLinksPreview();
    setHidden(els.partnerLinksPreviewModal, false);
    document.body.classList.add('partner-links-modal-open');
  }

  function closePartnerLinksPreview() {
    setHidden(els.partnerLinksPreviewModal, true);
    document.body.classList.remove('partner-links-modal-open');
  }

  function renderPartnerLinksPreview() {
    if (!els.partnerLinksPreviewModal) return;
    let item = getPartnerLinksSelectedItem();
    if (!item) {
      item = ensurePartnerLinksSelectedItem();
    }

    if (!item) {
      closePartnerLinksPreview();
      return;
    }

    const uiLanguage = getPartnerUiLanguage();
    const landingPl = buildPartnerLinksReferralUrl(item, { lang: 'pl', kind: 'landing' });
    const landingEn = buildPartnerLinksReferralUrl(item, { lang: 'en', kind: 'landing' });
    const offerPl = buildPartnerLinksReferralUrl(item, { lang: 'pl', kind: 'detail' });
    const offerEn = buildPartnerLinksReferralUrl(item, { lang: 'en', kind: 'detail' });
    const landingCurrent = buildPartnerLinksReferralUrl(item, { lang: uiLanguage, kind: 'landing' });
    const offerCurrent = buildPartnerLinksReferralUrl(item, { lang: uiLanguage, kind: 'detail' });
    const title = getPartnerLinksLocalizedText(item, 'title', uiLanguage, 'title') || item.title;
    const description = getPartnerLinksLocalizedText(item, 'description', uiLanguage, 'description') || item.description;

    if (els.partnerLinksPreviewCategory) {
      els.partnerLinksPreviewCategory.textContent = partnerLinksTypeLabel(item.type);
    }
    if (els.partnerLinksPreviewTitle) {
      els.partnerLinksPreviewTitle.textContent = title || item.title;
    }
    if (els.partnerLinksPreviewMeta) {
      els.partnerLinksPreviewMeta.textContent = item.meta || 'Ready to share';
    }
    if (els.partnerLinksPreviewDescription) {
      els.partnerLinksPreviewDescription.textContent = description || getPartnerLinksFallbackDescription(item.type);
    }
    if (els.partnerLinksPreviewImage instanceof HTMLImageElement) {
      if (item.imageUrl && item.type !== 'transport') {
        els.partnerLinksPreviewImage.src = item.imageUrl;
        els.partnerLinksPreviewImage.alt = title || item.title;
        els.partnerLinksPreviewImage.hidden = false;
      } else {
        els.partnerLinksPreviewImage.hidden = true;
        els.partnerLinksPreviewImage.removeAttribute('src');
        els.partnerLinksPreviewImage.alt = '';
      }
    }
    if (els.partnerLinksPreviewIntro instanceof HTMLElement) {
      els.partnerLinksPreviewIntro.classList.toggle('is-no-image', !(item.imageUrl && item.type !== 'transport'));
    }

    const setInputValue = (input, value) => {
      if (input instanceof HTMLInputElement) {
        input.value = value || '';
      }
    };

    setInputValue(els.partnerLinksPreviewLandingLinkPl, landingPl);
    setInputValue(els.partnerLinksPreviewLandingLinkEn, landingEn);
    setInputValue(els.partnerLinksPreviewOfferLinkPl, offerPl);
    setInputValue(els.partnerLinksPreviewOfferLinkEn, offerEn);

    const setButtonUrl = (button, value) => {
      if (!(button instanceof HTMLElement)) return;
      const href = String(value || '').trim();
      button.dataset.partnerLinkOpen = href;
      button.disabled = !href;
    };

    setButtonUrl(els.btnPartnerLinksOpenLanding, landingCurrent);
    setButtonUrl(els.btnPartnerLinksOpenOffer, offerCurrent);

    const setCopyDisabled = (button, value) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = !String(value || '').trim();
      }
    };

    setCopyDisabled(els.btnPartnerLinksCopyLandingPl, landingPl);
    setCopyDisabled(els.btnPartnerLinksCopyLandingEn, landingEn);
    setCopyDisabled(els.btnPartnerLinksCopyOfferPl, offerPl);
    setCopyDisabled(els.btnPartnerLinksCopyOfferEn, offerEn);

    if (els.partnerLinksPreviewTransportBox) {
      const showTransportBox = item.type === 'transport';
      setHidden(els.partnerLinksPreviewTransportBox, !showTransportBox);
      if (showTransportBox) {
        if (els.partnerLinksPreviewTransportPrice) {
          els.partnerLinksPreviewTransportPrice.textContent = item.transportFromPrice
            ? `from ${item.transportFromPrice}`
            : (item.meta || 'Transport route');
        }
        if (els.partnerLinksPreviewTransportNote) {
          els.partnerLinksPreviewTransportNote.textContent = item.transportNote || item.description || 'Share this route with your referral code attached.';
        }
      }
    }
  }

  function renderPartnerDiscountCodes() {
    if (!els.partnerDiscountCodesList) return;
    const rows = Array.isArray(state.linksDiscounts.discountCodes) ? state.linksDiscounts.discountCodes : [];
    const uiLanguage = getPartnerUiLanguage();
    if (!rows.length) {
      els.partnerDiscountCodesList.innerHTML = '<div class="partner-links-empty">No discount codes assigned to this partner.</div>';
      return;
    }

    els.partnerDiscountCodesList.innerHTML = rows.map((row) => {
      const description = uiLanguage === 'pl'
        ? String(row?.description || row?.description_en || row?.name || 'Partner discount code').trim()
        : String(row?.description_en || row?.description || row?.name || 'Partner discount code').trim();
      return `
      <article class="partner-discount-card">
        <div class="partner-discount-card__head">
          <strong>${escapeHtml(String(row?.code || '—'))}</strong>
          <span class="partner-links-card__category">${escapeHtml(formatPartnerDiscountScope(row))}</span>
        </div>
        <div class="partner-discount-card__body">
          <div>${escapeHtml(description)}</div>
          <div class="partner-discount-card__meta">
            <span class="partner-discount-status partner-discount-status--${escapeHtml(row?.statusKey || 'inactive')}">${escapeHtml(row?.statusLabel || 'Inactive')}</span>
            ${row?.whereWorks ? `<span class="partner-discount-card__scope">${escapeHtml(row.whereWorks)}</span>` : ''}
          </div>
          ${row?.validity ? `<div class="partner-discount-card__validity">${escapeHtml(row.validity)}</div>` : ''}
        </div>
      </article>
    `;
    }).join('');
  }

  async function loadPartnerLinksServiceItems() {
    if (!state.sb) return [];
    const safeRows = async (tableName, options = {}) => {
      const {
        select = '*',
        limit = 160,
        filters = [],
        orderColumns = ['updated_at', 'created_at', null],
      } = options;
      const runQuery = async (orderColumn = 'updated_at') => {
        let query = state.sb
          .from(tableName)
          .select(select);
        filters.forEach((applyFilter) => {
          if (typeof applyFilter === 'function') {
            query = applyFilter(query) || query;
          }
        });
        if (orderColumn) {
          query = query.order(orderColumn, { ascending: false });
        }
        query = query.limit(limit);
        return withRateLimitRetry(() => query);
      };

      let response = null;
      for (const orderColumn of orderColumns) {
        response = await runQuery(orderColumn);
        if (!response.error) break;
        const message = String(response.error.message || '');
        const isMissingOrderColumn = orderColumn && new RegExp(`column .*${orderColumn}|could not find.*${orderColumn}`, 'i').test(message);
        if (!isMissingOrderColumn) {
          throw response.error;
        }
      }
      if (!response) return [];
      if (response.error) throw response.error;
      return Array.isArray(response.data) ? response.data : [];
    };

    const blogRowsPromise = withRateLimitRetry(() => state.sb
      .from('blog_posts')
      .select(`
        id,
        published_at,
        cover_image_url,
        translations:blog_post_translations (
          lang,
          slug,
          title,
          summary,
          lead
        )
      `)
      .eq('status', 'published')
      .eq('submission_status', 'approved')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(120));

    const settled = await Promise.allSettled([
      safeRows('trips', {
        select: '*',
        limit: 120,
        filters: [(query) => query.eq('is_published', true)],
      }),
      safeRows('hotels', {
        select: '*',
        limit: 120,
        filters: [(query) => query.eq('is_published', true)],
      }),
      safeRows('car_offers', {
        select: '*',
        limit: 120,
        filters: [
          (query) => query.eq('is_published', true),
          (query) => query.eq('is_available', true),
        ],
      }),
      safeRows('transport_routes', {
        select: 'id, origin_location_id, destination_location_id, day_price, night_price, currency, included_passengers, included_bags, max_passengers, max_bags, is_active, sort_order',
        limit: 120,
        filters: [(query) => query.eq('is_active', true)],
        orderColumns: ['sort_order', 'updated_at', 'created_at', null],
      }),
      safeRows('transport_locations', {
        select: 'id, name, name_local, code, is_active, sort_order',
        limit: 240,
        orderColumns: ['sort_order', 'updated_at', 'created_at', null],
      }),
      safeRows('shop_products', {
        select: '*',
        limit: 120,
        filters: [(query) => query.eq('status', 'active')],
      }),
      blogRowsPromise,
    ]);

    const getSettledRows = (entry, label) => {
      if (entry.status === 'fulfilled') {
        const value = entry.value;
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.data)) return value.data;
        return [];
      }
      console.warn(`[partners] Failed to load ${label} for Links / Discounts:`, entry.reason);
      return [];
    };

    const trips = getSettledRows(settled[0], 'trips');
    const hotels = getSettledRows(settled[1], 'hotels');
    const cars = getSettledRows(settled[2], 'cars');
    const routes = getSettledRows(settled[3], 'transport_routes');
    const locations = getSettledRows(settled[4], 'transport_locations');
    const products = getSettledRows(settled[5], 'shop_products');
    const blogRows = getSettledRows(settled[6], 'blog_posts');

    const locationById = new Map((Array.isArray(locations) ? locations : []).map((row) => [String(row?.id || '').trim(), row]));
    const items = [];

    trips.forEach((row) => {
      const item = normalizePartnerLinksItem('trips', row);
      if (item?.slugByLang?.en || item?.slugByLang?.pl || item?.slug) items.push(item);
    });
    hotels.forEach((row) => {
      const item = normalizePartnerLinksItem('hotels', row);
      if (item?.slugByLang?.en || item?.slugByLang?.pl || item?.slug) items.push(item);
    });
    cars.forEach((row) => {
      const item = normalizePartnerLinksItem('cars', row);
      if (item) items.push(item);
    });
    routes.forEach((row) => {
      const origin = locationById.get(String(row?.origin_location_id || '').trim()) || null;
      const destination = locationById.get(String(row?.destination_location_id || '').trim()) || null;
      const originLabel = String(origin?.name || origin?.name_local || origin?.code || 'Origin').trim();
      const destinationLabel = String(destination?.name || destination?.name_local || destination?.code || 'Destination').trim();
      const item = normalizePartnerLinksItem('transport', row, {
        routeLabel: `${originLabel} → ${destinationLabel}`,
        routeMeta: String(row?.currency || 'EUR').trim().toUpperCase() || 'EUR',
      });
      if (item) items.push(item);
    });
    products.forEach((row) => {
      const item = normalizePartnerLinksItem('shop', row);
      if (item) items.push(item);
    });
    blogRows.forEach((row) => {
      const item = normalizePartnerLinksItem('blog', row);
      if (item?.slugByLang?.pl || item?.slugByLang?.en) items.push(item);
    });

    return items.sort((left, right) => {
      const leftType = String(left?.type || '').trim().toLowerCase();
      const rightType = String(right?.type || '').trim().toLowerCase();
      const leftOrder = getPartnerLinksTypeSortOrder(leftType);
      const rightOrder = getPartnerLinksTypeSortOrder(rightType);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return String(left?.title || '').localeCompare(String(right?.title || ''), 'en', { sensitivity: 'base' });
    });
  }

  async function waitForPartnerLinksContextReady(timeoutMs = 2600) {
    const deadline = Date.now() + Math.max(200, Number(timeoutMs) || 2600);
    while (Date.now() < deadline) {
      if (state.selectedPartnerId) return true;
      const fallbackPartnerId = Object.keys(state.partnersById || {})[0] || null;
      if (fallbackPartnerId) {
        state.selectedPartnerId = fallbackPartnerId;
        renderPartnerSelect();
        return true;
      }
      if (!bootstrapInFlight) break;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    const finalFallbackPartnerId = Object.keys(state.partnersById || {})[0] || null;
    if (finalFallbackPartnerId) {
      state.selectedPartnerId = finalFallbackPartnerId;
      renderPartnerSelect();
      return true;
    }
    return false;
  }

  async function loadPartnerDiscountCodes() {
    if (!state.sb || !state.selectedPartnerId) return [];

    const rows = [];
    try {
      const [{ data: serviceCoupons, error: serviceError }, { data: carCoupons, error: carError }, { data: shopDiscounts, error: shopError }] = await Promise.all([
        withRateLimitRetry(() => state.sb
          .from('service_coupons')
          .select('id, service_type, code, name, description, status, is_active, starts_at, expires_at')
          .eq('partner_id', state.selectedPartnerId)
          .order('created_at', { ascending: false })
          .limit(80)),
        withRateLimitRetry(() => state.sb
          .from('car_coupons')
          .select('id, code, name, description, status, is_active, starts_at, expires_at, applicable_locations, applicable_offer_ids, applicable_car_models, applicable_car_types')
          .eq('partner_id', state.selectedPartnerId)
          .order('created_at', { ascending: false })
          .limit(80)),
        state.user?.id
          ? withRateLimitRetry(() => state.sb
            .from('shop_discounts')
            .select('id, code, description, description_en, is_active, starts_at, expires_at, applicable_product_ids, applicable_category_ids, applicable_vendor_ids, user_ids')
            .contains('user_ids', [state.user.id])
            .order('created_at', { ascending: false })
            .limit(80))
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (serviceError) throw serviceError;
      if (carError) throw carError;
      if (shopError) throw shopError;

      (Array.isArray(serviceCoupons) ? serviceCoupons : []).forEach((row) => {
        const statusMeta = summarizePartnerDiscountStatus(row);
        const serviceType = String(row?.service_type || '').trim().toLowerCase();
        rows.push({
          ...row,
          type: serviceType,
          whereWorks: formatPartnerDiscountScope({ ...row, type: serviceType }),
          statusKey: statusMeta.key,
          statusLabel: statusMeta.label,
          validity: formatPartnerDiscountValidity(row),
        });
      });
      (Array.isArray(carCoupons) ? carCoupons : []).forEach((row) => {
        const statusMeta = summarizePartnerDiscountStatus(row);
        rows.push({
          ...row,
          type: 'cars',
          whereWorks: formatPartnerDiscountScope({ ...row, type: 'cars' }),
          statusKey: statusMeta.key,
          statusLabel: statusMeta.label,
          validity: formatPartnerDiscountValidity(row),
        });
      });
      (Array.isArray(shopDiscounts) ? shopDiscounts : []).forEach((row) => {
        const statusMeta = summarizePartnerDiscountStatus(row);
        rows.push({
          ...row,
          type: 'shop',
          whereWorks: formatPartnerDiscountScope({ ...row, type: 'shop' }),
          description: String(row?.description_en || row?.description || '').trim(),
          statusKey: statusMeta.key,
          statusLabel: statusMeta.label,
          validity: formatPartnerDiscountValidity(row),
        });
      });
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (!message.includes('service_coupons') && !message.includes('car_coupons') && !message.includes('shop_discounts')) {
        throw error;
      }
    }

    const priority = { active: 0, scheduled: 1, draft: 2, inactive: 3, expired: 4 };
    return rows.sort((left, right) => {
      const leftPriority = priority[left?.statusKey] ?? 9;
      const rightPriority = priority[right?.statusKey] ?? 9;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return String(left?.code || '').localeCompare(String(right?.code || ''), 'en', { sensitivity: 'base' });
    });
  }

  async function refreshPartnerLinksDiscountsView() {
    if (!state.session || !state.user) {
      showToast('Please log in to view Links / Discounts.', 'error');
      openAuthModal('login');
      return;
    }
    if (!state.selectedPartnerId) {
      await waitForPartnerLinksContextReady();
    }
    if (!state.selectedPartnerId) {
      renderPartnerLinksViewTabs();
      syncPartnerLinksViewPanels();
      if (els.partnerLinksGrid) {
        els.partnerLinksGrid.innerHTML = '<div class="partner-links-empty">No partner context is available for this account yet.</div>';
      }
      if (els.partnerDiscountCodesList) {
        els.partnerDiscountCodesList.innerHTML = '<div class="partner-links-empty">No partner discount data is available for this account yet.</div>';
      }
      return;
    }

    renderPartnerLinksViewTabs();
    syncPartnerLinksViewPanels();
    renderPartnerLinksFilters();
    if (els.partnerLinksGrid) {
      els.partnerLinksGrid.innerHTML = '<div class="partner-links-empty">Loading services…</div>';
    }
    if (els.partnerDiscountCodesList) {
      els.partnerDiscountCodesList.innerHTML = '<div class="partner-links-empty">Loading discount codes…</div>';
    }

    try {
      const [items, discountCodes] = await Promise.all([
        loadPartnerLinksServiceItems(),
        loadPartnerDiscountCodes(),
      ]);
      state.linksDiscounts.items = items;
      state.linksDiscounts.discountCodes = discountCodes;
      ensurePartnerLinksSelectedItem();
      renderPartnerLinksViewTabs();
      syncPartnerLinksViewPanels();
      renderPartnerLinksFilters();
      renderPartnerLinksGrid();
      renderPartnerDiscountCodes();
      if (!els.partnerLinksPreviewModal?.hidden) {
        renderPartnerLinksPreview();
      }
    } catch (error) {
      console.error(error);
      showToast(error?.message || 'Failed to load Links / Discounts', 'error');
      renderPartnerLinksViewTabs();
      syncPartnerLinksViewPanels();
      if (els.partnerLinksGrid) {
        els.partnerLinksGrid.innerHTML = '<div class="partner-links-empty">Failed to load services.</div>';
      }
      if (els.partnerDiscountCodesList) {
        els.partnerDiscountCodesList.innerHTML = '<div class="partner-links-empty">Failed to load discount codes.</div>';
      }
    }
  }

  async function navToLinksDiscounts() {
    if (!state.session || !state.user) {
      showToast('Please log in to view Links / Discounts.', 'error');
      openAuthModal('login');
      return;
    }

    setMainView('links-discounts');
    setSidebarActive(els.partnerNavLinksDiscounts);
    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = 'Partner Portal — Links / Discounts';
    }
    renderPartnerLinksViewTabs();
    syncPartnerLinksViewPanels();
    await refreshPartnerLinksDiscountsView();
    closeSidebar();
  }

  function setAllReferralTreeExpanded(expanded) {
    const walk = (node) => {
      if (!node) return;
      node.expanded = !!expanded;
      (node.children || []).forEach(walk);
    };
    walk(referralTreeRoot);
  }

  function renderReferralTree() {
    if (!els.partnerReferralTreeContainer) return;

    const q = String(referralTreeQuery || '').trim().toLowerCase();

    const matches = (node) => {
      if (!q) return true;
      const hay = `${node.username || ''} ${node.name || ''} ${node.email || ''}`.toLowerCase();
      return hay.includes(q);
    };

    const subtreeMatches = (node) => {
      if (!node) return false;
      if (matches(node)) return true;
      return (node.children || []).some(subtreeMatches);
    };

    const renderNode = (node, isRoot) => {
      if (!node) return '';
      if (q && !subtreeMatches(node)) return '';

      const hasChildren = (node.children || []).length > 0;
      const expanded = q ? true : !!node.expanded;

      const toggleHtml = hasChildren
        ? `<div class="tree-toggle tree-toggle-active" data-toggle-id="${escapeHtml(node.id)}">${expanded ? '−' : '+'}</div>`
        : `<div class="tree-toggle" style="opacity:0; pointer-events:none;">+</div>`;

      const avatarUrl = node.avatar_url ? escapeHtml(node.avatar_url) : '';
      const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" class="tree-avatar" alt="av" onerror="this.style.display='none'"/>`
        : `<div class="tree-avatar-placeholder">${escapeHtml(String(node.username || '?').charAt(0).toUpperCase())}</div>`;

      const childCount = (node.children || []).length;
      const status = node.referral_status ? String(node.referral_status) : '';
      const statusDot = status
        ? `<span class="status-dot status-${escapeHtml(status)}" title="${escapeHtml(status)}"></span>`
        : '';

      const dateStr = node.referral_date || node.created_at;
      let dateDisplay = '';
      try {
        dateDisplay = dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '';
      } catch (_e) {
        dateDisplay = '';
      }

      const rowClass = `tree-row${hasChildren ? ' tree-row-parent' : ''}${isRoot ? ' tree-row-root' : ''}`;
      const childrenHtml = hasChildren && expanded
        ? `<div class="tree-children-container" data-children-of="${escapeHtml(node.id)}">${(node.children || []).map((c) => renderNode(c, false)).join('')}</div>`
        : (hasChildren ? `<div class="tree-children-container" data-children-of="${escapeHtml(node.id)}" style="display:none;"></div>` : '');

      const username = escapeHtml(node.username || 'Unknown');
      const email = escapeHtml(node.email || '—');
      const name = escapeHtml(node.name || '');
      const metaName = name ? `<span class="tree-email">${name}</span>` : `<span class="tree-email">${email}</span>`;
      const metaDate = dateDisplay ? `<span class="tree-date">• ${escapeHtml(dateDisplay)}</span>` : '';

      return `
        <div class="tree-item" data-node-id="${escapeHtml(node.id)}">
          <div class="${rowClass}">
            <div class="tree-connector">${toggleHtml}</div>
            <div class="tree-content">
              <div class="tree-user-card">
                ${avatarHtml}
                <div class="tree-user-details">
                  <div class="tree-user-header">
                    <strong class="tree-username">${username}</strong>
                    ${statusDot}
                    ${childCount ? `<span class="badge-referrals">${escapeHtml(String(childCount))} refs</span>` : ''}
                  </div>
                  <div class="tree-user-meta">
                    ${metaName}
                    ${metaDate}
                  </div>
                </div>
              </div>
            </div>
          </div>
          ${childrenHtml}
        </div>
      `;
    };

    if (!referralTreeRoot) {
      els.partnerReferralTreeContainer.innerHTML = '<p class="muted">Loading referral tree...</p>';
      return;
    }

    if (!(referralTreeRoot.children || []).length) {
      els.partnerReferralTreeContainer.innerHTML = '<p class="muted">No invited users yet.</p>';
      return;
    }

    els.partnerReferralTreeContainer.innerHTML = renderNode(referralTreeRoot, true);

    els.partnerReferralTreeContainer.querySelectorAll('[data-toggle-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = el.getAttribute('data-toggle-id');
        if (!id) return;

        const findNode = (node) => {
          if (!node) return null;
          if (String(node.id) === String(id)) return node;
          for (const c of node.children || []) {
            const found = findNode(c);
            if (found) return found;
          }
          return null;
        };

        const node = findNode(referralTreeRoot);
        if (!node) return;
        node.expanded = !node.expanded;
        renderReferralTree();
      });
    });
  }

  async function refreshReferralStatsAndTree() {
    if (!state.sb || !state.user?.id) return;

    setText(els.partnerReferralStatDirect, '0');
    if (els.partnerReferralTreeContainer) {
      els.partnerReferralTreeContainer.innerHTML = '<p class="muted">Loading referral tree...</p>';
    }

    const userId = state.user.id;
    const MAX_DEPTH = 4;
    const MAX_NODES = 400;
    const IN_CHUNK = 80;

    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const fetchEdgesForReferrers = async (referrerIds) => {
      const ids = (referrerIds || []).filter(Boolean);
      if (!ids.length) return [];

      const rows = [];
      for (const part of chunk(ids, IN_CHUNK)) {
        const { data, error } = await state.sb
          .from('referrals')
          .select('referrer_id,referred_id,status,created_at')
          .in('referrer_id', part);
        if (error) throw error;
        (data || []).forEach((r) => rows.push(r));
      }
      return rows;
    };

    const fetchProfilesByIds = async (ids) => {
      const result = {};
      const clean = (ids || []).filter(Boolean);
      if (!clean.length) return result;

      for (const part of chunk(clean, IN_CHUNK)) {
        const { data, error } = await state.sb
          .from('profiles')
          .select('id,username,name,email,created_at,avatar_url')
          .in('id', part);
        if (error) throw error;
        (data || []).forEach((p) => {
          if (p?.id) result[p.id] = p;
        });
      }
      return result;
    };

    let edges = [];
    const visited = new Set([userId]);

    try {
      const queriedReferrers = new Set();
      let frontier = [userId];
      let depth = 0;

      while (frontier.length && depth < MAX_DEPTH && visited.size < MAX_NODES) {
        const toQuery = frontier.filter((id) => id && !queriedReferrers.has(id));
        if (!toQuery.length) break;

        toQuery.forEach((id) => queriedReferrers.add(id));

        const rows = await fetchEdgesForReferrers(toQuery);
        if (!rows.length) break;

        const nextFrontier = new Set();
        rows.forEach((r) => {
          if (!r?.referrer_id || !r?.referred_id) return;
          edges.push(r);
          if (!visited.has(r.referred_id) && visited.size < MAX_NODES) {
            visited.add(r.referred_id);
            nextFrontier.add(r.referred_id);
          }
        });

        frontier = Array.from(nextFrontier);
        depth += 1;
      }
    } catch (e) {
      try {
        const { data, error } = await state.sb
          .from('referrals')
          .select('referrer_id,referred_id,status,created_at')
          .eq('referrer_id', userId)
          .limit(MAX_NODES);
        if (error) throw error;
        edges = data || [];
        (edges || []).forEach((r) => {
          if (r?.referred_id) visited.add(r.referred_id);
        });
      } catch (e2) {
        console.error(e);
        console.error(e2);
        referralTreeRoot = { id: userId, username: (state.profile?.username || state.user?.email || 'You'), name: '', email: '', created_at: '', avatar_url: '', children: [], expanded: true, referral_status: null, referral_date: null };
        if (els.partnerReferralTreeContainer) {
          els.partnerReferralTreeContainer.innerHTML = '<p class="muted">Unable to load referral tree.</p>';
        }
        return;
      }
    }

    const uniqueDirect = new Set(edges.filter((e) => String(e.referrer_id) === String(userId)).map((e) => e.referred_id));
    const directInvited = uniqueDirect.size;

    setText(els.partnerReferralStatDirect, String(directInvited));

    let profileMap = {};
    try {
      profileMap = await fetchProfilesByIds(Array.from(visited));
    } catch (e) {
      console.error(e);
      profileMap = {};
    }

    const nodeById = {};
    const ensureNode = (id) => {
      if (!id) return null;
      if (nodeById[id]) return nodeById[id];

      const p = profileMap[id] || {};
      const fallback = id === userId
        ? (state.profile?.username || state.user?.email || 'You')
        : `${String(id).slice(0, 8)}…`;

      nodeById[id] = {
        id,
        username: p.username || fallback,
        name: p.name || '',
        email: p.email || '',
        created_at: p.created_at || '',
        avatar_url: p.avatar_url || '',
        children: [],
        expanded: true,
        referral_status: null,
        referral_date: null,
      };

      return nodeById[id];
    };

    const root = ensureNode(userId);
    edges.forEach((r) => {
      const parent = ensureNode(r?.referrer_id);
      const child = ensureNode(r?.referred_id);
      if (!parent || !child) return;

      child.referral_status = r?.status || null;
      child.referral_date = r?.created_at || null;

      if (!parent.children.some((c) => String(c.id) === String(child.id))) {
        parent.children.push(child);
      }
    });

    const sortChildren = (node) => {
      if (!node) return;
      node.children = (node.children || []).sort((a, b) => String(a.username || '').localeCompare(String(b.username || '')));
      node.children.forEach(sortChildren);
    };
    sortChildren(root);

    referralTreeRoot = root;
    renderReferralTree();
  }

  function navToCalendar() {
    const { isAffiliateOnly } = getSelectedPartnerCapabilities();
    if (isAffiliateOnly) {
      navToCategory('all');
      return;
    }
    setMainView('portal');
    setSidebarActive(els.partnerNavCalendar);

    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = 'Partner Portal — Availability';
    }

    setActiveTab('calendar');
    closeSidebar();
  }

  async function navToAnalytics() {
    if (!state.session || !state.user) {
      showToast('Please log in to view analytics.', 'error');
      openAuthModal('login');
      return;
    }
    if (!partnerCanAccessAnalytics()) {
      showToast('Analytics is not available for this partner.', 'info');
      navToCategory('all');
      return;
    }

    ensureAnalyticsFilterDefaults();
    syncAnalyticsCategoryOptions();
    syncAnalyticsFilterVisibility();

    setMainView('analytics');
    setSidebarActive(els.partnerNavAnalytics);

    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = 'Partner Portal — Analytics';
    }

    await refreshPartnerAnalyticsView();
    closeSidebar();
  }

  async function navToProfile() {
    if (!state.session || !state.user) {
      showToast('Please log in to manage your profile.', 'error');
      openAuthModal('login');
      return;
    }

    setMainView('profile');
    setSidebarActive(els.partnerNavProfile);

    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = 'Profile';
    }

    setProfileMessage('');

    await loadMyProfile();
    renderProfileSettings();
    try {
      const payout = await loadPartnerPayoutDetails();
      renderPartnerPayoutDetails(payout);
    } catch (_e) {
    }
    await refreshReferralWidget();

    closeSidebar();
  }

  function stopBlocksRealtime() {
    if (!blocksRealtimeChannel || !state.sb) return;
    try {
      if (typeof state.sb.removeChannel === 'function') {
        state.sb.removeChannel(blocksRealtimeChannel);
      } else if (typeof blocksRealtimeChannel.unsubscribe === 'function') {
        blocksRealtimeChannel.unsubscribe();
      }
    } catch (_e) {
    }
    blocksRealtimeChannel = null;
  }

  function scheduleBlocksRealtimeRefresh() {
    if (blocksRealtimeTimer) {
      clearTimeout(blocksRealtimeTimer);
    }
    blocksRealtimeTimer = setTimeout(async () => {
      blocksRealtimeTimer = null;
      try {
        if (!state.selectedPartnerId) return;
        if (!els.tabCalendar?.hidden) {
          await refreshCalendar();
        } else {
          await loadBlocks();
          syncResourceTypeOptions();
        }
      } catch (_e) {
      }
    }, 350);
  }

  function startBlocksRealtime() {
    stopBlocksRealtime();
    if (!state.sb || typeof state.sb.channel !== 'function') return;
    if (!state.selectedPartnerId) return;

    try {
      blocksRealtimeChannel = state.sb
        .channel(`partner-blocks-${String(state.selectedPartnerId).slice(0, 8)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'partner_availability_blocks' },
          (payload) => {
            const row = payload?.new || payload?.old || null;
            if (!row) return;
            if (String(row.partner_id || '') !== String(state.selectedPartnerId)) return;
            scheduleBlocksRealtimeRefresh();
          }
        )
        .subscribe();
    } catch (_e) {
      blocksRealtimeChannel = null;
    }
  }

  async function refreshSelectedPartnerRecord() {
    if (!state.selectedPartnerId) return;

    try {
      let partners = null;
      let pErr = null;

      ({ data: partners, error: pErr } = await state.sb
        .from('partners')
        .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog, can_manage_transport, cars_locations, affiliate_enabled')
        .eq('id', state.selectedPartnerId)
        .limit(1));

      if (pErr && (/cars_locations/i.test(String(pErr.message || '')) || /affiliate_enabled/i.test(String(pErr.message || '')) || /can_manage_transport/i.test(String(pErr.message || '')))) {
        ({ data: partners, error: pErr } = await state.sb
          .from('partners')
          .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog')
          .eq('id', state.selectedPartnerId)
          .limit(1));
      }

      if (pErr) throw pErr;

      const row = Array.isArray(partners) ? partners[0] : null;
      if (row?.id) {
        state.partnersById[row.id] = row;
      }
    } catch (_e) {
    }
  }

  function hideSelectForPanels(selectEl) {
    if (!selectEl) return;
    selectEl.style.display = 'none';
  }

  function labelForResourceType(type) {
    const t = String(type || '').trim();
    if (t === 'shop') return 'Products';
    if (t === 'cars') return 'Cars';
    if (t === 'trips') return 'Trips';
    if (t === 'hotels') return 'Hotels';
    if (t === 'transport') return 'Transport';
    return t;
  }

  function getMonthValue(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function normalizeMonthValue(value, fallback = getMonthValue()) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (!match) return fallback;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const nowYear = new Date().getFullYear();
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return fallback;
    if (year < 2000 || year > nowYear + 5) return fallback;
    return `${match[1]}-${match[2]}`;
  }

  function monthToStartEnd(monthValue) {
    const mv = String(monthValue || '').trim();
    const [yStr, mStr] = mv.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      const fallback = getMonthValue();
      return monthToStartEnd(fallback);
    }
    const start = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 12, 0, 0));
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);
    return { start, end, startIso, endIso };
  }

  function addMonths(monthValue, delta) {
    const mv = String(monthValue || '').trim();
    const [yStr, mStr] = mv.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const base = (Number.isFinite(y) && Number.isFinite(m))
      ? new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))
      : new Date();
    base.setUTCMonth(base.getUTCMonth() + Number(delta || 0));
    return getMonthValue(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 12, 0, 0)));
  }

  function setCalendarMonthInput(value) {
    const input = els.calendarMonthInput;
    if (!input) return;
    const next = normalizeMonthValue(value, getMonthValue());
    input.value = next;
    state.calendar.monthValue = next;
  }

  function ensureCalendarMonthInput() {
    const input = els.calendarMonthInput;
    if (!input) return;
    const fromState = normalizeMonthValue(state.calendar.monthValue, '');
    if (fromState) {
      setCalendarMonthInput(fromState);
      return;
    }
    const fromInput = normalizeMonthValue(input.value, '');
    if (fromInput) {
      setCalendarMonthInput(fromInput);
      return;
    }
    setCalendarMonthInput(getMonthValue());
  }

  function dateRangeOverlapsMonth(startIso, endIso, monthStartIso, monthEndIso) {
    if (!startIso || !endIso) return false;
    return String(startIso) <= String(monthEndIso) && String(endIso) >= String(monthStartIso);
  }

  function isBusyOnDay(dayIso, blocks, ranges) {
    const d = String(dayIso);
    const bb = Array.isArray(blocks) ? blocks : [];
    const rr = Array.isArray(ranges) ? ranges : [];
    return bb.some(b => String(b.start_date) <= d && String(b.end_date) >= d)
      || rr.some(r => String(r.start_date) <= d && String(r.end_date) >= d);
  }

  function chunkArray(input, size) {
    const arr = Array.isArray(input) ? input : [];
    const s = Math.max(1, Number(size || 0) || 50);
    const out = [];
    for (let i = 0; i < arr.length; i += s) out.push(arr.slice(i, i + s));
    return out;
  }

  function availabilityTypes() {
    return ['shop', 'cars', 'trips', 'hotels', 'transport'];
  }

  function isAvailabilityType(value) {
    return availabilityTypes().includes(String(value || '').trim());
  }

  function ensureSelectedSetForType(type) {
    const t = String(type || '').trim();
    if (!isAvailabilityType(t)) return new Set();
    if (!state.availability.selectedByType[t] || !(state.availability.selectedByType[t] instanceof Set)) {
      state.availability.selectedByType[t] = new Set();
    }
    return state.availability.selectedByType[t];
  }

  function clearAvailabilitySelectionsForType(type) {
    const set = ensureSelectedSetForType(type);
    set.clear();
  }

  function clearAvailabilitySelectionsAll() {
    availabilityTypes().forEach((t) => clearAvailabilitySelectionsForType(t));
  }

  function setAvailabilityBulkMode(enabled) {
    state.availability.bulkMode = Boolean(enabled);
    if (els.availabilityBulkMode) els.availabilityBulkMode.checked = state.availability.bulkMode;

    if (state.availability.bulkMode) {
      const currentType = String(els.blockResourceType?.value || '').trim();
      const currentId = String(els.blockResourceId?.value || '').trim();
      if (currentType && currentId) {
        ensureSelectedSetForType(currentType).add(currentId);
      }
    }

    const disabled = !state.availability.bulkMode;
    if (els.btnAvailabilitySelectAllType) els.btnAvailabilitySelectAllType.disabled = disabled;
    if (els.btnAvailabilityClearAll) els.btnAvailabilityClearAll.disabled = disabled;
    updateAvailabilitySelectionSummary();
    renderResourcePanels();
  }

  function allowedAvailabilityTypes() {
    const opts = Array.from(els.blockResourceType?.options || []).map(o => String(o.value || '').trim()).filter(Boolean);
    const allowed = opts.filter(isAvailabilityType);
    return allowed.length ? allowed : availabilityTypes();
  }

  async function ensureResourcesLoadedForType(type) {
    const t = String(type || '').trim();
    if (!isAvailabilityType(t)) return [];
    const existing = state.calendar.resourcesByType?.[t];
    if (Array.isArray(existing) && existing.length) return existing;
    try {
      const rows = await loadCalendarResourcesForType(t);
      state.calendar.resourcesByType[t] = rows;
      return rows;
    } catch (_e) {
      state.calendar.resourcesByType[t] = [];
      return [];
    }
  }

  async function getAvailabilityTargets() {
    const currentType = String(els.blockResourceType?.value || '').trim();
    const currentId = String(els.blockResourceId?.value || '').trim();

    if (!state.selectedPartnerId) return [];

    if (!state.availability.bulkMode) {
      return (currentType && currentId) ? [{ resource_type: currentType, resource_id: currentId }] : [];
    }

    const targets = [];
    availabilityTypes().forEach((t) => {
      const set = ensureSelectedSetForType(t);
      Array.from(set).forEach((id) => {
        if (!id) return;
        targets.push({ resource_type: t, resource_id: String(id) });
      });
    });

    const dedup = new Map();
    targets.forEach((t) => {
      const rt = String(t.resource_type || '').trim();
      const rid = String(t.resource_id || '').trim();
      if (!rt || !rid) return;
      dedup.set(`${rt}:${rid}`, { resource_type: rt, resource_id: rid });
    });
    return Array.from(dedup.values());
  }

  function updateAvailabilitySelectionSummary() {
    if (!els.availabilitySelectionSummary) return;

    const bulk = Boolean(state.availability.bulkMode);
    if (!bulk) {
      els.availabilitySelectionSummary.textContent = '';
      return;
    }

    const parts = [];
    let total = 0;
    availabilityTypes().forEach((t) => {
      const count = ensureSelectedSetForType(t).size;
      if (!count) return;
      parts.push(`${t}: ${count}`);
      total += count;
    });

    const sel = parts.length ? parts.join(', ') : 'none';
    els.availabilitySelectionSummary.textContent = `Selected: ${sel} (total ${total}).`;
  }

  async function bulkDeleteBlocksByIds(ids) {
    const list = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
    if (!list.length) return;
    for (const chunk of chunkArray(list, 50)) {
      const { error } = await state.sb
        .from('partner_availability_blocks')
        .delete()
        .in('id', chunk)
        .eq('partner_id', state.selectedPartnerId);
      if (error) throw error;
    }
  }

  async function bulkInsertBlocks(payloads) {
    const list = Array.isArray(payloads) ? payloads : [];
    if (!list.length) return;
    for (const chunk of chunkArray(list, 50)) {
      const { error } = await state.sb
        .from('partner_availability_blocks')
        .insert(chunk);
      if (error) throw error;
    }
  }

  async function toggleSingleDayBlocksForTargets(dayIso, targets) {
    if (!state.selectedPartnerId) return;
    const day = String(dayIso || '').trim();
    const list = Array.isArray(targets) ? targets : [];
    if (!day || !list.length) return;

    const byType = {};
    list.forEach((t) => {
      const rt = String(t.resource_type || '').trim();
      const rid = String(t.resource_id || '').trim();
      if (!rt || !rid) return;
      if (!byType[rt]) byType[rt] = new Set();
      byType[rt].add(rid);
    });

    const existingByKey = new Map();
    for (const rt of Object.keys(byType)) {
      const ids = Array.from(byType[rt]);
      for (const chunk of chunkArray(ids, 50)) {
        const { data, error } = await state.sb
          .from('partner_availability_blocks')
          .select('id, resource_type, resource_id, start_date, end_date')
          .eq('partner_id', state.selectedPartnerId)
          .eq('resource_type', rt)
          .in('resource_id', chunk)
          .eq('start_date', day)
          .eq('end_date', day)
          .limit(500);
        if (error) throw error;
        (data || []).forEach((b) => {
          if (!b?.id || !b?.resource_type || !b?.resource_id) return;
          existingByKey.set(`${String(b.resource_type)}:${String(b.resource_id)}`, b);
        });
      }
    }

    const keys = list.map(t => `${String(t.resource_type)}:${String(t.resource_id)}`);
    const existingKeys = keys.filter(k => existingByKey.has(k));
    const shouldUnblockAll = existingKeys.length === keys.length;

    if (shouldUnblockAll) {
      const idsToDelete = existingKeys.map(k => existingByKey.get(k)?.id).filter(Boolean);
      await bulkDeleteBlocksByIds(idsToDelete);
      showToast(list.length > 1 ? `Day unblocked (${list.length} resources)` : 'Day unblocked', 'success');
      return;
    }

    const payloads = [];
    list.forEach((t) => {
      const key = `${String(t.resource_type)}:${String(t.resource_id)}`;
      if (existingByKey.has(key)) return;
      payloads.push({
        partner_id: state.selectedPartnerId,
        resource_type: t.resource_type,
        resource_id: t.resource_id,
        start_date: day,
        end_date: day,
        note: null,
        created_by: state.user?.id || null,
      });
    });
    await bulkInsertBlocks(payloads);
    showToast(list.length > 1 ? `Day blocked (${payloads.length} resources)` : 'Day blocked', 'success');
  }

  async function createRangeBlocksForTargets(startDate, endDate, note, targets) {
    if (!state.selectedPartnerId) return;
    const start = String(startDate || '').trim();
    const end = String(endDate || '').trim();
    const list = Array.isArray(targets) ? targets : [];
    if (!start || !end || !list.length) return;

    const byType = {};
    list.forEach((t) => {
      const rt = String(t.resource_type || '').trim();
      const rid = String(t.resource_id || '').trim();
      if (!rt || !rid) return;
      if (!byType[rt]) byType[rt] = new Set();
      byType[rt].add(rid);
    });

    const existingByKey = new Set();
    for (const rt of Object.keys(byType)) {
      const ids = Array.from(byType[rt]);
      for (const chunk of chunkArray(ids, 50)) {
        const { data, error } = await state.sb
          .from('partner_availability_blocks')
          .select('id, resource_type, resource_id, start_date, end_date')
          .eq('partner_id', state.selectedPartnerId)
          .eq('resource_type', rt)
          .in('resource_id', chunk)
          .eq('start_date', start)
          .eq('end_date', end)
          .limit(500);
        if (error) throw error;
        (data || []).forEach((b) => {
          if (!b?.resource_type || !b?.resource_id) return;
          existingByKey.add(`${String(b.resource_type)}:${String(b.resource_id)}`);
        });
      }
    }

    const payloads = [];
    list.forEach((t) => {
      const key = `${String(t.resource_type)}:${String(t.resource_id)}`;
      if (existingByKey.has(key)) return;
      payloads.push({
        partner_id: state.selectedPartnerId,
        resource_type: t.resource_type,
        resource_id: t.resource_id,
        start_date: start,
        end_date: end,
        note: note || null,
        created_by: state.user?.id || null,
      });
    });

    await bulkInsertBlocks(payloads);
    showToast(payloads.length > 1 ? `Blocks created (${payloads.length} resources)` : 'Block created', 'success');
  }

  async function loadCalendarMonthData() {
    if (!els.calendarMonthGrid) return;

    const type = String(els.blockResourceType?.value || '').trim();
    const resourceId = String(els.blockResourceId?.value || '').trim();
    ensureCalendarMonthInput();
    const monthValue = state.calendar.monthValue || getMonthValue();
    const { startIso, endIso } = monthToStartEnd(monthValue);

    state.calendar.monthBlocks = [];
    state.calendar.monthBusyRanges = [];

    if (!state.selectedPartnerId || !type || !resourceId) {
      renderCalendarMonthGrid();
      return;
    }

    try {
      const { data: monthBlocks, error: blocksError } = await state.sb
        .from('partner_availability_blocks')
        .select('id, partner_id, resource_type, resource_id, start_date, end_date, note')
        .eq('partner_id', state.selectedPartnerId)
        .eq('resource_type', type)
        .eq('resource_id', resourceId)
        .lte('start_date', endIso)
        .gte('end_date', startIso)
        .limit(500);
      if (blocksError) throw blocksError;
      state.calendar.monthBlocks = monthBlocks || [];

      const ranges = [];
      if (type === 'cars') {
        try {
          const { data, error } = await state.sb
            .from('partner_service_fulfillments')
            .select('start_date, end_date, status')
            .eq('resource_type', 'cars')
            .eq('resource_id', resourceId)
            .in('status', ['pending_acceptance', 'accepted'])
            .lte('start_date', endIso)
            .gte('end_date', startIso)
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r.start_date || !r.end_date) return;
            ranges.push({ start_date: r.start_date, end_date: r.end_date });
          });
        } catch (_e) {}
      }

      if (type === 'hotels') {
        try {
          const { data, error } = await state.sb
            .from('hotel_bookings')
            .select('arrival_date, departure_date, status')
            .eq('hotel_id', resourceId)
            .neq('status', 'cancelled')
            .lte('arrival_date', endIso)
            .gte('departure_date', startIso)
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r.arrival_date || !r.departure_date) return;
            ranges.push({ start_date: r.arrival_date, end_date: r.departure_date });
          });
        } catch (_e) {}
      }

      if (type === 'trips') {
        try {
          const { data, error } = await state.sb
            .from('partner_service_fulfillments')
            .select('start_date, end_date, status')
            .eq('resource_type', 'trips')
            .eq('resource_id', resourceId)
            .in('status', ['pending_acceptance', 'accepted'])
            .lte('start_date', endIso)
            .gte('end_date', startIso)
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r.start_date || !r.end_date) return;
            ranges.push({ start_date: r.start_date, end_date: r.end_date });
          });
        } catch (_e) {}
      }

      if (type === 'transport') {
        try {
          const { data, error } = await state.sb
            .from('partner_service_fulfillments')
            .select('start_date, end_date, status')
            .eq('resource_type', 'transport')
            .eq('resource_id', resourceId)
            .in('status', ['pending_acceptance', 'awaiting_payment', 'accepted'])
            .lte('start_date', endIso)
            .gte('end_date', startIso)
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r.start_date || !r.end_date) return;
            ranges.push({ start_date: r.start_date, end_date: r.end_date });
          });
        } catch (_e) {}
      }

      state.calendar.monthBusyRanges = ranges;
    } catch (error) {
      console.error(error);
      state.calendar.monthBlocks = [];
      state.calendar.monthBusyRanges = [];
    }

    renderCalendarMonthGrid();
  }

  function renderCalendarMonthGrid() {
    const grid = els.calendarMonthGrid;
    if (!grid) return;

    const type = String(els.blockResourceType?.value || '').trim();
    const resourceId = String(els.blockResourceId?.value || '').trim();
    ensureCalendarMonthInput();
    const monthValue = state.calendar.monthValue || getMonthValue();
    const { start, end, startIso, endIso } = monthToStartEnd(monthValue);

    if (!type || !resourceId) {
      setHtml(grid, '<div style="grid-column: 1 / -1; color: var(--admin-text-muted); padding: 10px;">Select resource type + resource to view calendar</div>');
      return;
    }

    const blocks = (state.calendar.monthBlocks || [])
      .filter(b => b.resource_type === type && String(b.resource_id) === resourceId && dateRangeOverlapsMonth(b.start_date, b.end_date, startIso, endIso));
    const ranges = state.calendar.monthBusyRanges || [];

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const headerHtml = dayNames.map(d => `<div style="padding: 8px 6px; font-size: 12px; text-align:center; color: var(--admin-text-muted);">${d}</div>`).join('');

    const firstDow = (start.getUTCDay() + 6) % 7;
    const blanks = Array.from({ length: firstDow }).map(() => '<div style="height: 44px;"></div>').join('');

    const todayIso = new Date().toISOString().slice(0, 10);
    const days = [];
    for (let day = 1; day <= end.getUTCDate(); day += 1) {
      const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 12, 0, 0));
      const iso = dt.toISOString().slice(0, 10);
      const busy = isBusyOnDay(iso, blocks, ranges);
      const bg = busy ? 'rgba(107,114,128,0.35)' : 'rgba(34,197,94,0.20)';
      const border = busy ? 'rgba(107,114,128,0.60)' : 'rgba(34,197,94,0.55)';
      const outline = iso === todayIso ? '0 0 0 2px rgba(59,130,246,0.65) inset' : 'none';
      days.push(`
        <button
          type="button"
          data-day="${escapeHtml(iso)}"
          style="height: 44px; border-radius: 8px; background:${bg}; border: 1px solid ${border}; display:flex; align-items:center; justify-content:center; font-weight: 600; box-shadow: ${outline}; cursor:pointer;"
          title="${escapeHtml(iso)}"
        >${day}</button>
      `);
    }

    setHtml(grid, headerHtml + blanks + days.join(''));

    grid.querySelectorAll('button[data-day]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const dayIso = btn.getAttribute('data-day');
        if (!dayIso) return;
        await toggleSingleDayBlock(dayIso);
      });
    });
  }

  async function toggleSingleDayBlock(dayIso) {
    if (!state.selectedPartnerId) return;
    const type = String(els.blockResourceType?.value || '').trim();
    const resourceId = String(els.blockResourceId?.value || '').trim();

    if (!type) {
      showToast('Please select a resource', 'error');
      return;
    }

    try {
      if (state.availability.bulkMode) {
        const targets = await getAvailabilityTargets();
        if (!targets.length) {
          showToast('No target resources selected', 'error');
          return;
        }
        await toggleSingleDayBlocksForTargets(dayIso, targets);
        await refreshCalendar();
        return;
      }

      if (!resourceId) {
        showToast('Please select a resource', 'error');
        return;
      }

      const existing = (state.calendar.monthBlocks || [])
        .find(b => String(b.start_date) === String(dayIso) && String(b.end_date) === String(dayIso) && String(b.resource_id) === String(resourceId) && String(b.resource_type) === String(type));

      if (existing?.id) {
        const { error } = await state.sb
          .from('partner_availability_blocks')
          .delete()
          .eq('id', existing.id)
          .eq('partner_id', state.selectedPartnerId);
        if (error) throw error;
        showToast('Day unblocked', 'success');
      } else {
        const payload = {
          partner_id: state.selectedPartnerId,
          resource_type: type,
          resource_id: resourceId,
          start_date: dayIso,
          end_date: dayIso,
          note: null,
          created_by: state.user?.id || null,
        };
        const { error } = await state.sb
          .from('partner_availability_blocks')
          .insert(payload);
        if (error) throw error;
        showToast('Day blocked', 'success');
      }

      await refreshCalendar();
    } catch (error) {
      console.error(error);
      showToast(`Error: ${error.message || 'Update failed'}`, 'error');
    }
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('en-US');
    } catch (_e) {
      return String(value);
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      const raw = String(value);
      const iso = raw.length === 10 ? `${raw}T00:00:00` : raw;
      return new Date(iso).toLocaleDateString('en-US');
    } catch (_e) {
      return String(value);
    }
  }

  function formatDateDmy(value) {
    if (!value) return '—';
    try {
      const raw = String(value);
      const iso = raw.length === 10 ? `${raw}T00:00:00` : raw;
      return new Date(iso).toLocaleDateString('en-GB');
    } catch (_e) {
      return String(value);
    }
  }

  function formatMoney(value, currency) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    const cur = String(currency || 'EUR').toUpperCase();
    if (cur === 'EUR') return `${num.toFixed(2)} EUR`;
    return `${num.toFixed(2)} ${cur}`;
  }

  function getCarsFulfillmentPricing(fulfillment) {
    const resourceType = String(fulfillment?.resource_type || '').trim().toLowerCase();
    const defaultCurrency = String(fulfillment?.currency || 'EUR').trim().toUpperCase() || 'EUR';
    const fallbackAmount = toNum(fulfillment?.total_price);
    const toFinite = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const detailsRaw = fulfillment?.details;
    const details = (detailsRaw && typeof detailsRaw === 'object')
      ? detailsRaw
      : (() => {
        if (typeof detailsRaw !== 'string') return null;
        try {
          const parsed = JSON.parse(detailsRaw);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_e) {
          return null;
        }
      })();

    const finalRentalAmount = toFinite(details?.final_rental_price);
    const finalServiceAmount = toFinite(details?.final_price ?? details?.total_price);
    const finalAmount = resourceType === 'cars'
      ? (finalRentalAmount == null ? finalServiceAmount : finalRentalAmount)
      : finalServiceAmount;
    const baseRentalAmount = toFinite(details?.base_rental_price);
    const baseServiceAmount = toFinite(details?.base_price);
    const discountAmountRaw = toFinite(details?.coupon_discount_amount ?? fulfillment?.coupon_discount_amount);
    const discountAmount = discountAmountRaw == null ? 0 : Math.max(discountAmountRaw, 0);
    const couponCode = String(details?.coupon_code || fulfillment?.coupon_code || '').trim().toUpperCase();
    const authoritativeTotal = toFinite(fulfillment?.total_price);
    const resolvedAmount = authoritativeTotal == null
      ? (finalAmount == null ? fallbackAmount : finalAmount)
      : authoritativeTotal;
    const baseAmount = baseRentalAmount == null
      ? (
        baseServiceAmount == null
          ? (resolvedAmount + discountAmount)
          : baseServiceAmount
      )
      : baseRentalAmount;

    return {
      amount: resolvedAmount,
      currency: defaultCurrency,
      baseAmount,
      discountAmount,
      finalAmount,
      couponCode,
      hasCoupon: Boolean(couponCode || discountAmount > 0),
    };
  }

  function formatSla(deadlineIso) {
    if (!deadlineIso) return '—';
    const deadline = new Date(deadlineIso);
    const diffMs = deadline.getTime() - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    if (!Number.isFinite(diffMin)) return '—';
    if (diffMin <= 0) return `OVERDUE (${formatDateTime(deadlineIso)})`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h ${m}m (${formatDateTime(deadlineIso)})`;
  }

  function statusBadge(status) {
    const s = String(status || '').trim().toLowerCase();
    const colors = {
      pending: '#f59e0b',
      message_sent: '#f59e0b',
      confirmed: '#22c55e',
      active: '#22c55e',
      completed: '#16a34a',
      cancelled: '#ef4444',
      awaiting_payment: '#6b7280',
      pending_acceptance: '#f59e0b',
      accepted: '#22c55e',
      rejected: '#ef4444',
      expired: '#ef4444',
      closed: '#6b7280',
    };
    const label = s === 'pending' || s === 'message_sent'
      ? '⏳ pending'
      : s === 'confirmed'
        ? '✅ confirmed'
      : s === 'active'
        ? '🚗 active'
      : s === 'completed'
        ? '✔️ completed'
      : s === 'cancelled'
        ? '❌ cancelled'
      : s === 'pending_acceptance'
        ? '⏳ pending'
      : s === 'accepted'
        ? '✅ accepted'
      : s === 'rejected'
        ? '❌ rejected'
          : s === 'awaiting_payment'
            ? '💳 awaiting'
            : s === 'closed'
              ? '🔒 closed'
            : s ? s : '—';
    const color = colors[s] || '#6b7280';
    return `<span class="badge" style="background:${color};">${escapeHtml(label)}</span>`;
  }

  function normalizeServiceBookingStatus(statusRaw) {
    const status = String(statusRaw || '').trim().toLowerCase();
    if (!status) return '';
    if (status === 'message_sent') return 'pending';
    if (status === 'active') return 'confirmed';
    return status;
  }

  function normalizeServiceFulfillmentStatus(statusRaw) {
    const status = String(statusRaw || '').trim().toLowerCase();
    if (!status) return '';
    if (status === 'pending_acceptance') return 'pending';
    if (status === 'awaiting_payment') return 'pending';
    if (status === 'accepted') return 'confirmed';
    if (status === 'rejected') return 'cancelled';
    if (status === 'expired') return 'cancelled';
    if (status === 'closed') return 'pending';
    return status;
  }

  function resolveServiceOrderStatus(fulfillment) {
    if (!fulfillment) return '';

    const bookingStatus = normalizeServiceBookingStatus(fulfillment.booking_status);
    const fulfillmentStatus = normalizeServiceFulfillmentStatus(fulfillment.status);

    if (bookingStatus === 'completed' || bookingStatus === 'cancelled') return bookingStatus;
    if (bookingStatus === 'confirmed') return 'confirmed';
    if (fulfillmentStatus) return fulfillmentStatus;
    return bookingStatus;
  }

  async function loadServiceBookingStateByKey(serviceRows) {
    const rows = Array.isArray(serviceRows) ? serviceRows : [];
    const out = {};

    const idsByType = {
      cars: new Set(),
      trips: new Set(),
      hotels: new Set(),
      transport: new Set(),
    };

    rows.forEach((row) => {
      if (!row) return;
      const type = normalizeServiceResourceType(row.resource_type);
      const bookingId = String(row.booking_id || '').trim();
      if (!bookingId) return;
      if (!idsByType[type]) return;
      idsByType[type].add(bookingId);
    });

    const upsertState = (type, bookingId, status, paymentStatus) => {
      const bid = String(bookingId || '').trim();
      if (!bid) return;
      const key = `${type}:${bid}`;
      out[key] = {
        status: normalizeServiceBookingStatus(status),
        paymentStatus: String(paymentStatus || '').trim().toLowerCase(),
      };
    };

    const chunkArray = (items, size) => {
      const outChunks = [];
      const src = Array.isArray(items) ? items : [];
      const step = Number.isFinite(size) && size > 0 ? Math.floor(size) : 100;
      for (let i = 0; i < src.length; i += step) {
        outChunks.push(src.slice(i, i + step));
      }
      return outChunks;
    };

    const loadCarsStatuses = async (carIds) => {
      if (!carIds.length) return;

      for (const idChunk of chunkArray(carIds, 120)) {
        try {
          let response = await state.sb
            .from('car_bookings')
            .select('id, status, payment_status')
            .in('id', idChunk)
            .limit(500);

          if (response.error && /payment_status/i.test(String(response.error.message || ''))) {
            response = await state.sb
              .from('car_bookings')
              .select('id, status')
              .in('id', idChunk)
              .limit(500);
          }

          if (!response.error) {
            (response.data || []).forEach((row) => {
              if (!row?.id) return;
              upsertState('cars', row.id, row.status, row.payment_status || null);
            });
          }
        } catch (error) {
          console.warn('Partner panel: failed to load car booking statuses:', error);
        }
      }

      for (const idChunk of chunkArray(carIds, 120)) {
        try {
          const { data, error } = await state.sb
            .from('service_deposit_requests')
            .select('booking_id, status, paid_at, created_at')
            .eq('resource_type', 'cars')
            .in('booking_id', idChunk)
            .order('created_at', { ascending: false })
            .limit(2000);
          if (error) throw error;

          const paidMap = {};
          (data || []).forEach((row) => {
            const bookingId = String(row?.booking_id || '').trim();
            if (!bookingId) return;
            const depositStatus = String(row?.status || '').trim().toLowerCase();
            if (depositStatus === 'paid' || row?.paid_at) {
              paidMap[bookingId] = true;
            } else if (!(bookingId in paidMap)) {
              paidMap[bookingId] = false;
            }
          });

          Object.entries(paidMap).forEach(([bookingId, isPaid]) => {
            if (!isPaid) return;
            const key = `cars:${bookingId}`;
            const current = out[key] || { status: '', paymentStatus: '' };
            const nextStatus = current.status === 'pending' || current.status === 'message_sent'
              ? 'confirmed'
              : (current.status || 'confirmed');
            out[key] = {
              ...current,
              status: nextStatus,
              paymentStatus: 'paid',
            };
          });
        } catch (error) {
          console.warn('Partner panel: failed to load paid deposits for cars:', error);
        }
      }
    };

    const loadSimpleStatuses = async (type, tableName, ids, options = {}) => {
      if (!ids.length) return;
      const includePaymentStatus = Boolean(options?.includePaymentStatus);
      for (const idChunk of chunkArray(ids, 120)) {
        try {
          let data = null;
          let error = null;

          ({ data, error } = await state.sb
            .from(tableName)
            .select(includePaymentStatus ? 'id, status, payment_status' : 'id, status')
            .in('id', idChunk)
            .limit(500));

          if (error && includePaymentStatus && /payment_status/i.test(String(error.message || ''))) {
            ({ data, error } = await state.sb
              .from(tableName)
              .select('id, status')
              .in('id', idChunk)
              .limit(500));
          }

          if (error) throw error;
          (data || []).forEach((row) => {
            if (!row?.id) return;
            upsertState(type, row.id, row.status, row.payment_status || null);
          });
        } catch (error) {
          console.warn(`Partner panel: failed to load ${type} booking statuses:`, error);
        }
      }
    };

    await Promise.all([
      loadCarsStatuses(Array.from(idsByType.cars || [])),
      loadSimpleStatuses('trips', 'trip_bookings', Array.from(idsByType.trips || [])),
      loadSimpleStatuses('hotels', 'hotel_bookings', Array.from(idsByType.hotels || [])),
      loadSimpleStatuses('transport', 'transport_bookings', Array.from(idsByType.transport || []), { includePaymentStatus: true }),
    ]);

    return out;
  }

  function selectPersistKey() {
    return 'ce_partner_selected_v1';
  }

  function getPersistedPartnerId() {
    try {
      return localStorage.getItem(selectPersistKey());
    } catch (_e) {
      return null;
    }
  }

  function setPersistedPartnerId(partnerId) {
    try {
      localStorage.setItem(selectPersistKey(), partnerId || '');
    } catch (_e) {}
  }

  function showWarning(message) {
    if (!els.warning) return;
    if (message == null || (typeof message === 'string' && message.trim() === '')) {
      els.warning.hidden = true;
      els.warning.textContent = '';
      return;
    }

    const normalizedMessage = partnerUserMessage(message, 'Session expired. Please sign in again.');
    if (!normalizedMessage) {
      els.warning.hidden = true;
      els.warning.textContent = '';
      return;
    }
    els.warning.hidden = false;
    els.warning.textContent = normalizedMessage;
  }

  async function openAuthModal(tab) {
    const controller = window.__authModalController;
    if (controller && typeof controller.open === 'function') {
      controller.open(tab || 'login');
      return;
    }

    const openers = document.querySelectorAll('[data-open-auth]');
    const opener = Array.from(openers).find((el) => (el.getAttribute('data-auth-target') || 'login') === (tab || 'login')) || openers[0];
    if (opener instanceof HTMLElement) {
      opener.click();
      return;
    }

    await new Promise((resolve) => {
      const handler = () => {
        document.removeEventListener('ce-auth:modal-ready', handler);
        resolve(null);
      };
      document.addEventListener('ce-auth:modal-ready', handler);
      setTimeout(() => {
        document.removeEventListener('ce-auth:modal-ready', handler);
        resolve(null);
      }, 1500);
    });

    const retryController = window.__authModalController;
    if (retryController && typeof retryController.open === 'function') {
      retryController.open(tab || 'login');
    }
  }

  function openLogin() {
    openAuthModal('login');
  }

  async function ensureSession() {
    const readSession = async () => {
      if (typeof state.sb?.auth?.getSessionSafe === 'function') {
        return state.sb.auth.getSessionSafe();
      }
      return state.sb.auth.getSession();
    };

    const applySession = (session) => {
      state.session = session || null;
      state.user = state.session?.user || null;
      return state.session;
    };

    const tryRefresh = async () => {
      if (typeof state.sb?.auth?.refreshSession !== 'function') return null;
      try {
        const { data, error } = await state.sb.auth.refreshSession();
        if (error) return null;
        return data?.session || null;
      } catch (_error) {
        return null;
      }
    };

    const { data, error } = await readSession();
    if (error) {
      if (isPartnerAuthError(error)) {
        const refreshed = await tryRefresh();
        if (refreshed?.access_token) {
          return applySession(refreshed);
        }
        throw new Error('Session expired. Please sign in again.');
      }
      throw error;
    }

    const current = data?.session || null;
    if (current?.access_token) {
      return applySession(current);
    }

    const refreshed = await tryRefresh();
    if (refreshed?.access_token) {
      return applySession(refreshed);
    }

    return applySession(current);
  }

  async function loadPartnersByIds(partnerIds) {
    const ids = Array.from(new Set((partnerIds || []).filter(Boolean)));
    if (!ids.length) return [];

    const fullSelect = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog, can_manage_transport, cars_locations, affiliate_enabled';
    const legacySelect = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog';

    const fetchWithColumns = async (columns) => withRateLimitRetry(() => {
      return state.sb
        .from('partners')
        .select(columns)
        .in('id', ids)
        .limit(Math.max(50, ids.length));
    });

    let data = null;
    let error = null;
    ({ data, error } = await fetchWithColumns(fullSelect));

    if (error && (/cars_locations/i.test(String(error.message || '')) || /affiliate_enabled/i.test(String(error.message || '')) || /can_manage_transport/i.test(String(error.message || '')))) {
      ({ data, error } = await fetchWithColumns(legacySelect));
    }

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function loadAccessiblePartnersFallback() {
    const fullSelect = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog, can_manage_transport, cars_locations, affiliate_enabled';
    const legacySelect = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_manage_blog, can_auto_publish_blog';

    const fetchWithColumns = async (columns) => withRateLimitRetry(() => {
      return state.sb
        .from('partners')
        .select(columns)
        .order('name', { ascending: true })
        .limit(100);
    });

    let data = null;
    let error = null;
    ({ data, error } = await fetchWithColumns(fullSelect));

    if (error && (/cars_locations/i.test(String(error.message || '')) || /affiliate_enabled/i.test(String(error.message || '')) || /can_manage_transport/i.test(String(error.message || '')))) {
      ({ data, error } = await fetchWithColumns(legacySelect));
    }

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function loadMemberships(userIdOverride = '') {
    let membershipUserId = String(userIdOverride || state.user?.id || '').trim();
    if (!membershipUserId && typeof state.sb?.auth?.getUser === 'function') {
      try {
        const { data, error } = await state.sb.auth.getUser();
        if (!error && data?.user?.id) {
          membershipUserId = String(data.user.id).trim();
          state.user = data.user || state.user;
        }
      } catch (_error) {
      }
    }

    let rows = [];
    let partnerUsersError = null;
    if (membershipUserId) {
      const { data: partnerUsers, error } = await withRateLimitRetry(() => state.sb
        .from('partner_users')
        .select('partner_id, role')
        .eq('user_id', membershipUserId)
        .order('created_at', { ascending: true }));

      if (error) {
        partnerUsersError = error;
        if (!isPartnerPermissionError(error)) {
          throw error;
        }
      } else {
        rows = Array.isArray(partnerUsers) ? partnerUsers : [];
      }
    }

    state.memberships = rows;
    state.partnersById = {};

    let partnerIds = Array.from(new Set(rows.map((r) => r.partner_id).filter(Boolean)));
    let partners = [];

    if (partnerIds.length) {
      partners = await loadPartnersByIds(partnerIds);
    } else {
      // Fallback: some environments expose partners via RLS helper policies while partner_users returns empty.
      const fallbackPartners = await loadAccessiblePartnersFallback();
      if (fallbackPartners.length) {
        partners = fallbackPartners;
        partnerIds = Array.from(new Set(fallbackPartners.map((partner) => partner?.id).filter(Boolean)));
        if (!state.memberships.length) {
          state.memberships = partnerIds.map((partnerId) => ({
            partner_id: partnerId,
            role: 'staff',
            source: 'partners_fallback',
          }));
        }
      }
    }

    (partners || []).forEach((partner) => {
      if (partner && partner.id) {
        state.partnersById[partner.id] = partner;
      }
    });

    const resolvedPartnerIds = Object.keys(state.partnersById);
    if (resolvedPartnerIds.length) {
      partnerIds = partnerIds.filter((id) => resolvedPartnerIds.includes(String(id)));
      if (state.memberships.length) {
        state.memberships = state.memberships.filter((m) => resolvedPartnerIds.includes(String(m?.partner_id || '')));
      }
    } else {
      partnerIds = [];
      state.memberships = [];
    }

    if (!partnerIds.length && partnerUsersError && !isPartnerPermissionError(partnerUsersError)) {
      throw partnerUsersError;
    }

    const persisted = getPersistedPartnerId();
    if (persisted && partnerIds.includes(persisted)) {
      state.selectedPartnerId = persisted;
    } else {
      state.selectedPartnerId = partnerIds[0] || null;
    }
  }

  function renderPartnerSelect() {
    if (!els.partnerSelect) return;

    const options = Object.values(state.partnersById)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map((partner) => {
        const label = `${partner.name}${partner.slug ? ` (${partner.slug})` : ''}`;
        return `<option value="${escapeHtml(partner.id)}">${escapeHtml(label)}</option>`;
      });

    setHtml(els.partnerSelect, options.join(''));

    if (state.selectedPartnerId) {
      els.partnerSelect.value = state.selectedPartnerId;
    }

    els.partnerSelect.disabled = options.length <= 1;
  }

  function renderSuspendedInfo() {
    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    if (!els.suspendedInfo) return;

    if (partner && partner.status === 'suspended') {
      els.suspendedInfo.hidden = false;
      els.suspendedInfo.textContent = 'This partner is suspended. Please contact support.';
      return;
    }

    els.suspendedInfo.hidden = true;
    els.suspendedInfo.textContent = '';
  }

  async function loadFulfillments() {
    if (!state.selectedPartnerId) return;

    const limit = 200;
    state.hotelResourcesById = {};
    state.hotelBookingsById = {};
    state.hotelDecisionSupportByBookingId = {};
    state.transportBookingsById = {};

    const [shopRes, serviceRes] = await Promise.all([
      state.sb
        .from('shop_order_fulfillments')
        .select('id, order_id, order_number, status, sla_deadline_at, accepted_at, rejected_at, rejected_reason, contact_revealed_at, created_at, subtotal, total_allocated')
        .eq('partner_id', state.selectedPartnerId)
        .order('created_at', { ascending: false })
        .limit(limit),
      state.sb
        .from('partner_service_fulfillments')
        .select('id, partner_id, resource_type, booking_id, resource_id, status, sla_deadline_at, accepted_at, rejected_at, rejected_reason, contact_revealed_at, created_at, reference, summary, start_date, end_date, total_price, currency, details')
        .eq('partner_id', state.selectedPartnerId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (shopRes.error) throw shopRes.error;

    let resolvedServiceRes = serviceRes;
    if (resolvedServiceRes.error && /details/i.test(String(resolvedServiceRes.error.message || ''))) {
      resolvedServiceRes = await state.sb
        .from('partner_service_fulfillments')
        .select('id, partner_id, resource_type, booking_id, resource_id, status, sla_deadline_at, accepted_at, rejected_at, rejected_reason, contact_revealed_at, created_at, reference, summary, start_date, end_date, total_price, currency')
        .eq('partner_id', state.selectedPartnerId)
        .order('created_at', { ascending: false })
        .limit(limit);
    }

    if (resolvedServiceRes.error) throw resolvedServiceRes.error;

    const rawShopRows = Array.isArray(shopRes.data) ? shopRes.data : [];
    const rawServiceRows = Array.isArray(resolvedServiceRes.data) ? resolvedServiceRes.data : [];

    const shopRows = rawShopRows.map((f) => ({ ...f, __source: 'shop' }));

    const closedCount = rawServiceRows.filter((f) => String(f?.status || '').trim() === 'closed').length;
    const serviceBookingStateByKey = await loadServiceBookingStateByKey(rawServiceRows);
    const serviceRows = rawServiceRows.map((f) => {
      const type = normalizeServiceResourceType(f?.resource_type);
      const bookingId = String(f?.booking_id || '').trim();
      const bookingState = serviceBookingStateByKey[`${type}:${bookingId}`] || null;
      return {
        ...f,
        resource_type: type || String(f?.resource_type || '').trim().toLowerCase(),
        __source: 'service',
        booking_status: bookingState?.status || null,
        booking_payment_status: bookingState?.paymentStatus || null,
      };
    });

    const merged = shopRows
      .concat(serviceRows)
      .sort((a, b) => {
        const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const hasCarsLocations = Array.isArray(partner?.cars_locations);
    const allowedCarLocsRaw = hasCarsLocations ? partner.cars_locations : [];
    const allowedCarLocs = allowedCarLocsRaw
      .map((l) => normalizeCarLocation(l) || String(l || '').trim().toLowerCase())
      .filter((l) => l === 'paphos' || l === 'larnaca');

    const assignedTripIds = await loadPartnerResourceIdsForType('trips');
    const assignedTripIdSet = new Set((assignedTripIds || []).map((id) => String(id)));
    const assignedTransportIds = await loadPartnerResourceIdsForType('transport');
    const assignedTransportIdSet = new Set((assignedTransportIds || []).map((id) => String(id)));

    const serviceCarRows = merged.filter((f) => {
      if (!f || f.__source !== 'service') return false;
      return String(f.resource_type || '') === 'cars';
    });

    const carOfferIds = Array.from(new Set(
      serviceCarRows
        .map((f) => f.resource_id)
        .filter(Boolean)
        .map((id) => String(id))
    ));

    const carOfferLocationById = {};

    if (carOfferIds.length) {
      try {
        const { data, error } = await state.sb
          .from('car_offers')
          .select('id, location')
          .in('id', carOfferIds)
          .limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const loc = normalizeCarLocation(r.location);
          if (loc) carOfferLocationById[String(r.id)] = loc;
        });
      } catch (_e) {}
    }

    const filteredMerged = merged.filter((f) => {
      if (!f) return false;
      if (f.__source !== 'service') return true;

      const rt = normalizeServiceResourceType(f.resource_type);

      if (rt === 'cars') {
        if (!partner?.can_manage_cars) return false;
        if (hasCarsLocations && !allowedCarLocs.length) return false;
        if (!allowedCarLocs.length) return true;

        if (f.resource_id) {
          const offerLoc = carOfferLocationById[String(f.resource_id)] || null;
          if (!offerLoc) return false;
          return allowedCarLocs.includes(offerLoc);
        }

        const loc = carLocationFromFulfillmentDetails(f.details);
        if (!loc) return false;
        return allowedCarLocs.includes(loc);
      }

      if (rt === 'trips') {
        if (!partner?.can_manage_trips) return false;
        if (!assignedTripIdSet.size) return true;
        if (!f.resource_id) return false;
        return assignedTripIdSet.has(String(f.resource_id));
      }

      if (rt === 'transport') {
        if (!partner?.can_manage_transport) return false;
        if (!assignedTransportIdSet.size) return true;
        if (!f.resource_id) return false;
        return assignedTransportIdSet.has(String(f.resource_id));
      }

      return true;
    });

    state.lastFulfillmentsDebug = {
      partner_id: state.selectedPartnerId,
      raw_shop: rawShopRows.length,
      raw_service: rawServiceRows.length,
      closed: closedCount,
      merged_total: merged.length,
      filtered_total: filteredMerged.length,
    };

    const serviceOnly = filteredMerged.filter((f) => f && f.__source === 'service');
    const tripIds = Array.from(new Set(
      serviceOnly
        .filter((f) => normalizeServiceResourceType(f.resource_type) === 'trips' && f.resource_id)
        .map((f) => f.resource_id)
        .filter(Boolean)
    ));
    const hotelIds = Array.from(new Set(
      serviceOnly
        .filter((f) => normalizeServiceResourceType(f.resource_type) === 'hotels' && f.resource_id)
        .map((f) => f.resource_id)
        .filter(Boolean)
    ));
    const transportBookingIds = Array.from(new Set(
      serviceOnly
        .filter((f) => normalizeServiceResourceType(f.resource_type) === 'transport')
        .map((f) => String(f?.booking_id || '').trim())
        .filter(Boolean)
    ));

    const tripById = {};
    const tripTitleMetaById = {};
    const hotelById = {};
    const hotelResourceById = {};
    const hotelBookingById = {};
    const hotelDecisionSupportByBookingId = {};
    const transportBookingById = {};
    const transportRouteById = {};
    const transportRouteEndpointsById = {};
    const transportLocationLabelById = {};

    const cleanTransportLabel = (value) => {
      const text = String(value || '').trim();
      if (!text) return '';
      if (text === '—') return '';
      if (/^unknown location$/i.test(text)) return '';
      return text;
    };

    const joinTransportRouteLabel = (originLabel, destinationLabel) => {
      const origin = cleanTransportLabel(originLabel);
      const destination = cleanTransportLabel(destinationLabel);
      if (!origin && !destination) return '';
      if (origin && destination) return `${origin} → ${destination}`;
      return `${origin || 'Origin'} → ${destination || 'Destination'}`;
    };

    if (tripIds.length) {
      try {
        const { data, error } = await state.sb
          .from('trips')
          .select('id, slug, title, start_city')
          .in('id', tripIds)
          .limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const titleObj = (r.title && typeof r.title === 'object') ? r.title : null;
          const titlePl = String((titleObj?.pl || titleObj?.en || normalizeTitleJson(r.title) || r.slug || String(r.id).slice(0, 8)) || '').trim();
          const titleEn = String((titleObj?.en || titleObj?.pl || normalizeTitleJson(r.title) || r.slug || String(r.id).slice(0, 8)) || '').trim();
          const title = titleEn && titlePl && titleEn.toLowerCase() !== titlePl.toLowerCase()
            ? `${titleEn} / ${titlePl}`
            : (titleEn || titlePl || r.slug || String(r.id).slice(0, 8));
          const city = r.start_city ? ` — ${r.start_city}` : '';
          tripById[r.id] = `${title}${city}`;
          tripTitleMetaById[r.id] = {
            en: titleEn || titlePl || '',
            pl: titlePl || titleEn || '',
            slug: String(r.slug || '').trim(),
          };
        });
      } catch (_e) {}
    }

    if (hotelIds.length) {
      try {
        let data = null;
        let error = null;
        ({ data, error } = await state.sb
          .from('hotels')
          .select('id, slug, title, city, cover_image_url, photos, room_types, address_line, district, postal_code, country, latitude, longitude, google_maps_url, google_place_id')
          .in('id', hotelIds)
          .limit(500));
        if (error && /(room_types|address_line|district|postal_code|country|latitude|longitude|google_maps_url|google_place_id)/i.test(String(error.message || ''))) {
          ({ data, error } = await state.sb
            .from('hotels')
            .select('id, slug, title, city, cover_image_url, photos')
            .in('id', hotelIds)
            .limit(500));
        }
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const title = normalizeTitleJson(r.title) || r.slug || String(r.id).slice(0, 8);
          const city = r.city ? ` — ${r.city}` : '';
          hotelById[r.id] = `${title}${city}`;
          hotelResourceById[String(r.id)] = r;
        });
      } catch (_e) {}
    }

    const hotelBookingIds = Array.from(new Set(
      serviceOnly
        .filter((f) => normalizeServiceResourceType(f.resource_type) === 'hotels' && f.booking_id)
        .map((f) => String(f.booking_id || '').trim())
        .filter(Boolean)
    ));

    if (hotelBookingIds.length) {
      try {
        for (const bookingIdChunk of chunkArray(hotelBookingIds, 120)) {
          let data = null;
          let error = null;
          ({ data, error } = await state.sb
            .from('hotel_bookings')
            .select('id, hotel_id, arrival_date, departure_date, nights, num_adults, num_children, total_price, base_price, final_price, extras_price, selected_extras, pricing_breakdown, booking_details, room_type_id, room_type_name, rate_plan_id, rate_plan_name, cancellation_policy_type, status')
            .in('id', bookingIdChunk)
            .limit(500));
          if (error && /(pricing_breakdown|booking_details|room_type_id|room_type_name|rate_plan_id|rate_plan_name|cancellation_policy_type|selected_extras|extras_price|base_price|final_price)/i.test(String(error.message || ''))) {
            ({ data, error } = await state.sb
              .from('hotel_bookings')
              .select('id, hotel_id, arrival_date, departure_date, nights, num_adults, num_children, total_price, status')
              .in('id', bookingIdChunk)
              .limit(500));
          }
          if (error) throw error;
          (data || []).forEach((row) => {
            if (!row?.id) return;
            hotelBookingById[String(row.id)] = row;
          });
        }
      } catch (error) {
        console.warn('Partner panel: failed to load hotel booking snapshots:', error);
      }
    }

    if (transportBookingIds.length) {
      try {
        for (const bookingIdChunk of chunkArray(transportBookingIds, 120)) {
          let data = null;
          let error = null;
          ({ data, error } = await state.sb
            .from('transport_bookings')
            .select('id, route_id, origin_location_id, destination_location_id, travel_date, travel_time, trip_type, num_passengers, num_bags, num_oversize_bags, child_seats, booster_seats, waiting_minutes, pickup_address, dropoff_address, flight_number, return_route_id, return_origin_location_id, return_destination_location_id, return_travel_date, return_travel_time, return_pickup_address, return_dropoff_address, return_flight_number, total_price, deposit_amount, currency, customer_name, customer_email, customer_phone')
            .in('id', bookingIdChunk)
            .limit(500));
          if (error && /(return_route_id|return_origin_location_id|return_destination_location_id|return_pickup_address|return_dropoff_address|return_flight_number|trip_type|waiting_minutes|currency|customer_name|customer_email|customer_phone)/i.test(String(error.message || ''))) {
            ({ data, error } = await state.sb
              .from('transport_bookings')
              .select('id, route_id, origin_location_id, destination_location_id, travel_date, travel_time, return_route_id, return_origin_location_id, return_destination_location_id, return_travel_date, return_travel_time, pickup_address, dropoff_address, flight_number, return_pickup_address, return_dropoff_address, return_flight_number, num_passengers, num_bags, num_oversize_bags, child_seats, booster_seats, total_price, deposit_amount')
              .in('id', bookingIdChunk)
              .limit(500));
          }
          if (error) throw error;
          (data || []).forEach((row) => {
            if (!row?.id) return;
            transportBookingById[String(row.id)] = row;
          });
        }
      } catch (error) {
        console.warn('Partner panel: failed to load transport booking snapshots:', error);
      }
    }

    const transportRouteIds = Array.from(new Set(
      serviceOnly
        .filter((f) => normalizeServiceResourceType(f.resource_type) === 'transport')
        .flatMap((f) => {
          const details = detailsObjectFromFulfillment(f) || {};
          const booking = transportBookingById[String(f?.booking_id || '').trim()] || null;
          return [
            String(f?.resource_id || '').trim(),
            String(details?.route_id || booking?.route_id || '').trim(),
            String(details?.return_route_id || booking?.return_route_id || '').trim(),
          ];
        })
        .filter(Boolean)
    ));

    const hotelBookingsForDecision = Object.values(hotelBookingById);
    const activeHotelIdsForDecision = Array.from(new Set(
      hotelBookingsForDecision
        .map((row) => String(row?.hotel_id || '').trim())
        .filter(Boolean)
    ));

    if (activeHotelIdsForDecision.length && hotelBookingsForDecision.length) {
      const arrivalDates = hotelBookingsForDecision
        .map((row) => normalizeIsoDateValue(row?.arrival_date))
        .filter(Boolean)
        .sort();
      const departureDates = hotelBookingsForDecision
        .map((row) => normalizeIsoDateValue(row?.departure_date))
        .filter(Boolean)
        .sort();
      const decisionWindowStart = arrivalDates[0] || '';
      const decisionWindowEnd = departureDates[departureDates.length - 1] || '';

      if (decisionWindowStart && decisionWindowEnd) {
        const activeRows = [];
        for (const hotelIdChunk of chunkArray(activeHotelIdsForDecision, 40)) {
          try {
            let data = null;
            let error = null;
            ({ data, error } = await state.sb
              .from('hotel_bookings')
              .select('id, hotel_id, arrival_date, departure_date, room_type_id, status')
              .in('hotel_id', hotelIdChunk)
              .neq('status', 'cancelled')
              .lt('arrival_date', decisionWindowEnd)
              .gt('departure_date', decisionWindowStart)
              .limit(1000));
            if (error && /room_type_id/i.test(String(error.message || ''))) {
              ({ data, error } = await state.sb
                .from('hotel_bookings')
                .select('id, hotel_id, arrival_date, departure_date, status')
                .in('hotel_id', hotelIdChunk)
                .neq('status', 'cancelled')
                .lt('arrival_date', decisionWindowEnd)
                .gt('departure_date', decisionWindowStart)
                .limit(1000));
            }
            if (error) throw error;
            activeRows.push(...(Array.isArray(data) ? data : []));
          } catch (error) {
            console.warn('Partner panel: failed to load hotel inventory context:', error);
          }
        }

        Object.values(hotelBookingById).forEach((booking) => {
          if (!booking?.id) return;
          const bookingId = String(booking.id || '').trim();
          const hotelId = String(booking.hotel_id || '').trim();
          const roomTypeId = String(booking.room_type_id || '').trim();
          if (!bookingId || !hotelId) return;

          const hotelResource = hotelResourceById[hotelId] || null;
          const roomTypes = Array.isArray(hotelResource?.room_types) ? hotelResource.room_types : [];
          const roomType = roomTypeId
            ? roomTypes.find((entry) => String(entry?.id || '').trim() === roomTypeId) || null
            : null;
          const configuredUnitsRaw = roomType?.inventory_units
            ?? booking?.booking_details?.room_inventory_units
            ?? booking?.room_inventory_units;
          const configuredUnits = Number(configuredUnitsRaw);
          const overlappingRows = activeRows.filter((row) => {
            if (!row) return false;
            if (String(row.hotel_id || '').trim() !== hotelId) return false;
            const rowRoomTypeId = String(row.room_type_id || '').trim();
            if (roomTypeId && rowRoomTypeId && rowRoomTypeId !== roomTypeId) return false;
            return hotelDateRangesOverlap(
              booking.arrival_date,
              booking.departure_date,
              row.arrival_date,
              row.departure_date,
            );
          });
          const overlappingOtherRequests = overlappingRows.filter((row) => String(row.id || '').trim() !== bookingId).length;
          const totalOverlappingIncludingThis = overlappingRows.length;
          const unitsLeftAfterThis = Number.isFinite(configuredUnits) && configuredUnits > 0
            ? Math.max(0, configuredUnits - totalOverlappingIncludingThis)
            : null;
          const exceedsConfiguredInventory = Boolean(Number.isFinite(configuredUnits) && configuredUnits > 0 && totalOverlappingIncludingThis > configuredUnits);

          hotelDecisionSupportByBookingId[bookingId] = {
            configuredUnits: Number.isFinite(configuredUnits) && configuredUnits > 0 ? configuredUnits : null,
            overlappingOtherRequests,
            totalOverlappingIncludingThis,
            unitsLeftAfterThis,
            exceedsConfiguredInventory,
          };
        });
      }
    }

    if (transportRouteIds.length) {
      try {
        const { data: routes, error: routesError } = await state.sb
          .from('transport_routes')
          .select('id, origin_location_id, destination_location_id')
          .in('id', transportRouteIds)
          .limit(500);
        if (routesError) throw routesError;

        const routeRows = Array.isArray(routes) ? routes : [];
        const locationIds = Array.from(new Set(routeRows.flatMap((r) => [r?.origin_location_id, r?.destination_location_id]).filter(Boolean)));
        const locationById = {};

        if (locationIds.length) {
          try {
            const { data: locations, error: locationsError } = await state.sb
              .from('transport_locations')
              .select('id, name, code')
              .in('id', locationIds)
              .limit(1000);
            if (locationsError) throw locationsError;
            (locations || []).forEach((loc) => {
              if (!loc?.id) return;
              locationById[loc.id] = loc;
              const label = cleanTransportLabel(loc?.name) || cleanTransportLabel(loc?.code);
              if (label) transportLocationLabelById[String(loc.id)] = label;
            });
          } catch (_e) {
          }
        }

        routeRows.forEach((route) => {
          if (!route?.id) return;
          const routeId = String(route.id || '').trim();
          if (!routeId) return;
          const originId = String(route.origin_location_id || '').trim();
          const destinationId = String(route.destination_location_id || '').trim();
          const origin = locationById[originId] || null;
          const destination = locationById[destinationId] || null;
          const originLabel = cleanTransportLabel(origin?.name)
            || cleanTransportLabel(origin?.code)
            || cleanTransportLabel(transportLocationLabelById[originId]);
          const destinationLabel = cleanTransportLabel(destination?.name)
            || cleanTransportLabel(destination?.code)
            || cleanTransportLabel(transportLocationLabelById[destinationId]);
          transportRouteEndpointsById[routeId] = {
            originId,
            destinationId,
            originLabel: originLabel || originId,
            destinationLabel: destinationLabel || destinationId,
          };
          transportRouteById[routeId] = joinTransportRouteLabel(originLabel || originId, destinationLabel || destinationId) || String(routeId).slice(0, 8);
        });
      } catch (_e) {
      }
    }

    const transportLookupVariants = (key) => {
      const k = String(key || '').trim();
      if (!k) return [];
      const out = new Set([k]);
      if (k.includes('_')) {
        const camel = k.replace(/_([a-z0-9])/g, (_m, c) => String(c || '').toUpperCase());
        if (camel) out.add(camel);
      } else if (/[A-Z]/.test(k)) {
        const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (snake) out.add(snake);
      }
      return Array.from(out);
    };

    const readTransportField = (fulfillment, ...keys) => {
      const details = detailsObjectFromFulfillment(fulfillment) || null;
      const booking = transportBookingById[String(fulfillment?.booking_id || '').trim()] || null;
      for (const key of keys) {
        const variants = transportLookupVariants(key);
        for (const source of [details, booking]) {
          if (!source || typeof source !== 'object') continue;
          for (const variant of variants) {
            const value = source[variant];
            if (value === undefined || value === null) continue;
            if (typeof value === 'string' && !value.trim()) continue;
            return value;
          }
        }
      }
      return null;
    };

    const resolveTransportRouteContext = (fulfillment) => {
      const outboundRouteId = String(readTransportField(fulfillment, 'route_id') || fulfillment?.resource_id || '').trim();
      const returnRouteId = String(readTransportField(fulfillment, 'return_route_id') || '').trim();

      const outboundEndpoints = outboundRouteId ? (transportRouteEndpointsById[outboundRouteId] || null) : null;
      const returnEndpoints = returnRouteId ? (transportRouteEndpointsById[returnRouteId] || null) : null;

      const outboundOrigin = cleanTransportLabel(outboundEndpoints?.originLabel)
        || cleanTransportLabel(transportLocationLabelById[String(readTransportField(fulfillment, 'origin_location_id') || '').trim()])
        || cleanTransportLabel(readTransportField(fulfillment, 'origin_location_name'))
        || cleanTransportLabel(readTransportField(fulfillment, 'origin_name'));
      const outboundDestination = cleanTransportLabel(outboundEndpoints?.destinationLabel)
        || cleanTransportLabel(transportLocationLabelById[String(readTransportField(fulfillment, 'destination_location_id') || '').trim()])
        || cleanTransportLabel(readTransportField(fulfillment, 'destination_location_name'))
        || cleanTransportLabel(readTransportField(fulfillment, 'destination_name'));
      const returnOrigin = cleanTransportLabel(returnEndpoints?.originLabel)
        || cleanTransportLabel(transportLocationLabelById[String(readTransportField(fulfillment, 'return_origin_location_id') || '').trim()])
        || cleanTransportLabel(readTransportField(fulfillment, 'return_origin_location_name'))
        || cleanTransportLabel(readTransportField(fulfillment, 'return_origin_name'));
      const returnDestination = cleanTransportLabel(returnEndpoints?.destinationLabel)
        || cleanTransportLabel(transportLocationLabelById[String(readTransportField(fulfillment, 'return_destination_location_id') || '').trim()])
        || cleanTransportLabel(readTransportField(fulfillment, 'return_destination_location_name'))
        || cleanTransportLabel(readTransportField(fulfillment, 'return_destination_name'));

      const outboundLabel = joinTransportRouteLabel(outboundOrigin, outboundDestination)
        || cleanTransportLabel(transportRouteById[outboundRouteId])
        || cleanTransportLabel(fulfillment?.summary);
      const returnLabel = joinTransportRouteLabel(returnOrigin, returnDestination)
        || cleanTransportLabel(transportRouteById[returnRouteId]);

      const tripType = String(readTransportField(fulfillment, 'trip_type') || '').trim().toLowerCase();
      const hasReturn = tripType === 'round_trip'
        || Boolean(
          returnRouteId
          || readTransportField(fulfillment, 'return_travel_date')
          || readTransportField(fulfillment, 'return_travel_time')
          || readTransportField(fulfillment, 'return_pickup_address')
          || readTransportField(fulfillment, 'return_dropoff_address')
          || readTransportField(fulfillment, 'return_flight_number')
          || returnLabel
        );

      let combinedLabel = '';
      if (!hasReturn) {
        combinedLabel = outboundLabel || 'Transport booking';
      } else if (!returnLabel) {
        combinedLabel = outboundLabel ? `${outboundLabel} (Round trip)` : 'Round trip';
      } else if (!outboundLabel) {
        combinedLabel = returnLabel;
      } else {
        const splitRouteLabel = (label) => {
          const text = String(label || '').trim();
          if (!text || !text.includes('→')) return null;
          const parts = text.split('→').map((part) => part.trim()).filter(Boolean);
          if (parts.length !== 2) return null;
          return { origin: parts[0], destination: parts[1] };
        };

        const outboundSplit = splitRouteLabel(outboundLabel);
        const returnSplit = splitRouteLabel(returnLabel);
        if (outboundSplit && returnSplit
            && outboundSplit.origin === returnSplit.destination
            && outboundSplit.destination === returnSplit.origin) {
          combinedLabel = `${outboundSplit.origin} ↔ ${outboundSplit.destination}`;
        }
        if (!combinedLabel && outboundLabel === returnLabel) combinedLabel = `${outboundLabel} (Round trip)`;
        if (!combinedLabel) combinedLabel = `${outboundLabel} | ${returnLabel}`;
      }

      return {
        tripType,
        hasReturn,
        outboundLabel: outboundLabel || '',
        returnLabel: returnLabel || '',
        combinedLabel,
      };
    };

    if (tripIds.length || hotelIds.length || transportRouteIds.length || transportBookingIds.length) {
      filteredMerged.forEach((f) => {
        if (!f || f.__source !== 'service') return;
        if (normalizeServiceResourceType(f.resource_type) === 'trips' && f.resource_id && tripById[f.resource_id]) {
          f.summary = tripById[f.resource_id];
          const meta = tripTitleMetaById[f.resource_id] || null;
          if (meta) {
            f.__tripTitleEn = String(meta.en || '').trim();
            f.__tripTitlePl = String(meta.pl || '').trim();
            f.__tripSlug = String(meta.slug || '').trim();
          }
        }
        if (normalizeServiceResourceType(f.resource_type) === 'hotels' && f.resource_id && hotelById[f.resource_id]) {
          f.summary = hotelById[f.resource_id];
        }
        if (normalizeServiceResourceType(f.resource_type) === 'transport') {
          const routeContext = resolveTransportRouteContext(f);
          f.__transportRouteContext = routeContext;
          f.summary = routeContext.combinedLabel;
        }
      });
    }

    const tripFulfillmentIds = Array.from(new Set(
      filteredMerged
        .filter((f) => f && f.__source === 'service' && normalizeServiceResourceType(f.resource_type) === 'trips' && f.id)
        .map((f) => String(f.id))
        .filter(Boolean)
    ));

    if (tripFulfillmentIds.length) {
      try {
        const requestRows = [];
        const chunkSize = 120;
        for (let i = 0; i < tripFulfillmentIds.length; i += chunkSize) {
          const chunk = tripFulfillmentIds.slice(i, i + chunkSize);
          const { data, error } = await state.sb
            .from('trip_date_selection_requests')
            .select('fulfillment_id, status, selected_date, customer_email_sent_at, selection_token_expires_at, updated_at')
            .in('fulfillment_id', chunk)
            .limit(500);
          if (error) throw error;
          requestRows.push(...(Array.isArray(data) ? data : []));
        }

        const latestRequestByFulfillmentId = {};
        requestRows.forEach((row) => {
          const fid = String(row?.fulfillment_id || '').trim();
          if (!fid) return;
          const currentMs = Date.parse(String(row?.updated_at || ''));
          const prev = latestRequestByFulfillmentId[fid];
          const prevMs = Date.parse(String(prev?.updated_at || ''));
          if (!prev || !Number.isFinite(prevMs) || (Number.isFinite(currentMs) && currentMs >= prevMs)) {
            latestRequestByFulfillmentId[fid] = row;
          }
        });

        filteredMerged.forEach((f) => {
          if (!f || f.__source !== 'service') return;
          if (normalizeServiceResourceType(f.resource_type) !== 'trips') return;
          const fid = String(f.id || '').trim();
          if (!fid) return;

          const req = latestRequestByFulfillmentId[fid];
          if (!req) return;

          const details = detailsObjectFromFulfillment(f) || {};
          const nextDetails = { ...details };
          const reqStatus = String(req?.status || '').trim().toLowerCase();
          const selectedDate = normalizeIsoDateValue(req?.selected_date);
          const sentAtRaw = String(req?.customer_email_sent_at || '').trim();
          const expiresAtRaw = String(req?.selection_token_expires_at || '').trim();
          const updatedAtRaw = String(req?.updated_at || '').trim();
          const sentAt = sentAtRaw || (reqStatus === 'sent_to_customer' ? updatedAtRaw : '');

          if (reqStatus) nextDetails.trip_date_selection_request_status = reqStatus;
          if (selectedDate && !nextDetails.selected_trip_date) nextDetails.selected_trip_date = selectedDate;
          if (sentAt) nextDetails.trip_date_options_sent_at = sentAt;
          if (expiresAtRaw) nextDetails.trip_date_options_expires_at = expiresAtRaw;

          const detailStatus = String(nextDetails.trip_date_selection_status || '').trim().toLowerCase();
          if (reqStatus === 'sent_to_customer' && (!detailStatus || detailStatus === 'options_proposed')) {
            nextDetails.trip_date_selection_status = 'options_sent_to_customer';
          }
          if (reqStatus === 'selected' && detailStatus !== 'not_required') {
            nextDetails.trip_date_selection_status = 'selected';
          }

          f.details = nextDetails;
        });
      } catch (error) {
        console.warn('Partner panel: failed to load trip date-selection request metadata:', error);
      }
    }

    state.fulfillments = filteredMerged;
    state.hotelResourcesById = hotelResourceById;
    state.hotelBookingsById = hotelBookingById;
    state.hotelDecisionSupportByBookingId = hotelDecisionSupportByBookingId;
    state.transportBookingsById = transportBookingById;

    const shopIds = filteredMerged.filter((f) => f && f.__source === 'shop').map((f) => f.id).filter(Boolean);
    const serviceIds = filteredMerged.filter((f) => f && f.__source === 'service').map((f) => f.id).filter(Boolean);

    state.itemsByFulfillmentId = {};
    state.contactsByFulfillmentId = {};
    state.formSnapshotsByFulfillmentId = {};
    state.serviceDepositByFulfillmentId = {};

    if (shopIds.length) {
      const { data: items, error: itemsErr } = await state.sb
        .from('shop_order_fulfillment_items')
        .select('fulfillment_id, product_name, variant_name, quantity, unit_price, subtotal')
        .in('fulfillment_id', shopIds)
        .limit(500);

      if (itemsErr) throw itemsErr;

      (items || []).forEach((it) => {
        const fid = it.fulfillment_id;
        if (!fid) return;
        if (!state.itemsByFulfillmentId[fid]) state.itemsByFulfillmentId[fid] = [];
        state.itemsByFulfillmentId[fid].push(it);
      });
    }

    const revealableShopIds = filteredMerged
      .filter((f) => f && f.__source === 'shop' && f.contact_revealed_at)
      .map((f) => f.id)
      .filter(Boolean);

    const revealableServiceIds = filteredMerged
      .filter((f) => f && f.__source === 'service' && f.contact_revealed_at)
      .map((f) => f.id)
      .filter(Boolean);

    if (revealableShopIds.length) {
      const { data: contacts, error: contactsErr } = await state.sb
        .from('shop_order_fulfillment_contacts')
        .select('fulfillment_id, customer_name, customer_email, customer_phone, shipping_address, billing_address')
        .in('fulfillment_id', revealableShopIds)
        .limit(200);

      if (contactsErr) throw contactsErr;

      (contacts || []).forEach((c) => {
        const fid = c.fulfillment_id;
        if (!fid) return;
        state.contactsByFulfillmentId[fid] = c;
      });
    }

    if (revealableServiceIds.length) {
      const { data: contacts, error: contactsErr } = await state.sb
        .from('partner_service_fulfillment_contacts')
        .select('fulfillment_id, customer_name, customer_email, customer_phone')
        .in('fulfillment_id', revealableServiceIds)
        .limit(200);

      if (contactsErr) throw contactsErr;

      (contacts || []).forEach((c) => {
        const fid = c.fulfillment_id;
        if (!fid) return;
        state.contactsByFulfillmentId[fid] = c;
      });
    }

    if (shopIds.length) {
      try {
        const { data: snapshots, error: snapshotsErr } = await state.sb
          .from('shop_order_fulfillment_form_snapshots')
          .select('fulfillment_id, payload')
          .in('fulfillment_id', shopIds)
          .limit(200);

        if (snapshotsErr) throw snapshotsErr;

        (snapshots || []).forEach((s) => {
          const fid = s?.fulfillment_id;
          if (!fid) return;
          state.formSnapshotsByFulfillmentId[String(fid)] = s;
        });
      } catch (e) {
        console.warn('Failed to load shop form snapshots:', e);
      }
    }

    if (serviceIds.length) {
      try {
        const { data: snapshots, error: snapshotsErr } = await state.sb
          .from('partner_service_fulfillment_form_snapshots')
          .select('fulfillment_id, payload')
          .in('fulfillment_id', serviceIds)
          .limit(200);

        if (snapshotsErr) throw snapshotsErr;

        (snapshots || []).forEach((s) => {
          const fid = s?.fulfillment_id;
          if (!fid) return;
          state.formSnapshotsByFulfillmentId[String(fid)] = s;
        });
      } catch (e) {
        console.warn('Failed to load service form snapshots:', e);
      }
    }

    if (serviceIds.length) {
      state.serviceDepositByFulfillmentId = await fetchServiceDepositByFulfillment(serviceIds);
    }
  }

  function updateKpis(filteredRows) {
    const rows = Array.isArray(filteredRows) ? filteredRows : filteredFulfillmentsForOrdersPanel();
    const pending = rows.filter((f) => fulfillmentStatusForOrders(f) === 'pending_acceptance').length;
    const awaiting = rows.filter((f) => fulfillmentStatusForOrders(f) === 'awaiting_payment').length;
    const accepted = rows.filter((f) => fulfillmentStatusForOrders(f) === 'confirmed').length;
    const rejected = rows.filter((f) => fulfillmentStatusForOrders(f) === 'cancelled_rejected').length;

    setText(els.kpiPending, String(pending));
    setText(els.kpiAccepted, String(accepted));
    setText(els.kpiRejected, String(rejected));

    if (els.fulfillmentsHint) {
      const hint = pending > 0
        ? `You have ${pending} fulfillment(s) awaiting acceptance.`
        : awaiting > 0
          ? `You have ${awaiting} fulfillment(s) awaiting payment confirmation.`
          : 'No fulfillments awaiting acceptance.';
      els.fulfillmentsHint.textContent = hint;
    }

    if (els.ordersFilterHint) {
      const paidForCalendar = rows
        .filter((row) => isFulfillmentPaidForOrders(row))
        .filter((row) => Boolean(fulfillmentScheduleRange(row)))
        .length;
      els.ordersFilterHint.textContent = `Showing ${rows.length} order(s) · Calendar shows ${paidForCalendar} payment-completed reservation(s).`;
    }
  }

  function refreshOrdersPanelViews() {
    syncOrdersFilterUiFromState();
    syncOrdersFilterCollapseUi();
    syncOrdersCalendarCollapseUi();
    applyOrdersTableDensity();
    const rows = filteredFulfillmentsForOrdersPanel();
    updateKpis(rows);
    renderFulfillmentsTable(rows);
    renderOrdersScheduleCalendar(rows);
  }

  function toNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function setTopContainer(el, html) {
    if (!el) return;
    if (!html) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = html;
  }

  function renderTopTable(title, rows) {
    const list = Array.isArray(rows) ? rows : [];
    return `
      <div class="admin-table-container" style="margin-top: 10px;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>${escapeHtml(title)}</th>
              <th style="text-align:right;">Qty</th>
              <th style="text-align:right;">Partner</th>
              <th style="text-align:right;">Gross</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map((r) => `
              <tr>
                <td>${escapeHtml(r.label || '—')}</td>
                <td style="text-align:right;">${Number(r.count || 0)}</td>
                <td style="text-align:right;"><strong>${escapeHtml(formatMoney(r.partner || 0, 'EUR'))}</strong></td>
                <td style="text-align:right;">${escapeHtml(formatMoney(r.gross || 0, 'EUR'))}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" class="muted" style="padding: 12px 8px;">No data</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  function computeTopFromMap(mapObj) {
    const rows = Object.values(mapObj || {});
    return rows
      .sort((a, b) => (toNum(b.partner) - toNum(a.partner)) || (toNum(b.gross) - toNum(a.gross)) || (toNum(b.count) - toNum(a.count)))
      .slice(0, 8);
  }

  async function refreshPortalResponseInsights() {
    const inPortal = Boolean(els.partnerPortalView && !els.partnerPortalView.hidden);
    const inFulfillmentsTab = Boolean(els.tabFulfillments && !els.tabFulfillments.hidden);
    const { isAffiliateOnly, hasAnyServicePermission } = getSelectedPartnerCapabilities();
    const canShow = inPortal && inFulfillmentsTab && hasAnyServicePermission && !isAffiliateOnly && Boolean(state.selectedPartnerId);

    setHidden(els.partnerPortalResponseCard, !canShow);
    if (!canShow) return;

    setText(els.partnerPortalEarningsValue, 'Loading…');
    setText(els.partnerPortalResponseYearAvg, 'Loading…');

    const rows = filteredFulfillmentsForSelectedCategory();
    const acceptedRows = rows.filter((f) => String(f?.status || '').trim() === 'accepted');
    const acceptedServiceIds = acceptedRows
      .filter((f) => String(f?.__source || '') === 'service')
      .map((f) => String(f?.id || '').trim())
      .filter(Boolean);

    const depositByFid = {};
    if (acceptedServiceIds.length && state.sb && state.selectedPartnerId) {
      try {
        const { data, error } = await state.sb.rpc('partner_get_service_deposit_amounts', {
          p_partner_id: state.selectedPartnerId,
        });
        if (!error) {
          (data || []).forEach((row) => {
            const fid = String(row?.fulfillment_id || '').trim();
            if (!fid) return;
            depositByFid[fid] = toNum(row?.amount);
          });
        }
      } catch (_e) {
      }
    }

    let partnerEarnings = 0;
    acceptedRows.forEach((f) => {
      const src = String(f?.__source || 'shop');
      if (src === 'service') {
        const gross = String(f?.resource_type || '').toLowerCase() === 'cars'
          ? getCarsFulfillmentPricing(f).amount
          : toNum(f?.total_price);
        const deposit = toNum(depositByFid[String(f?.id || '').trim()] || 0);
        partnerEarnings += Math.max(0, gross - deposit);
        return;
      }
      const allocated = Number(f?.total_allocated);
      partnerEarnings += Number.isFinite(allocated) ? allocated : toNum(f?.subtotal);
    });
    setText(els.partnerPortalEarningsValue, formatMoney(partnerEarnings, 'EUR'));

    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const cutoffMs = Date.now() - oneYearMs;
    const responseSourceRows = Array.isArray(state.fulfillments) ? state.fulfillments : [];
    const responseMinutesYear = responseSourceRows
      .map((row) => {
        const createdMs = parseIsoMs(row?.created_at);
        if (!Number.isFinite(createdMs) || createdMs < cutoffMs) return null;
        const minutes = responseMinutesFromFulfillment(row);
        return Number.isFinite(minutes) ? minutes : null;
      })
      .filter((minutes) => Number.isFinite(minutes));

    if (!responseMinutesYear.length) {
      setText(els.partnerPortalResponseYearAvg, '—');
      return;
    }

    const avgResponseMinutes = responseMinutesYear.reduce((sum, minutes) => sum + toNum(minutes), 0) / responseMinutesYear.length;
    setText(els.partnerPortalResponseYearAvg, formatResponseMinutes(avgResponseMinutes));
  }

  function currentUtcMonthValue() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function currentUtcYearValue() {
    return String(new Date().getUTCFullYear());
  }

  function ensureAnalyticsFilterDefaults() {
    if (!state.analytics.monthValue) state.analytics.monthValue = currentUtcMonthValue();
    if (!state.analytics.yearValue) state.analytics.yearValue = currentUtcYearValue();
    if (!state.analytics.period) state.analytics.period = 'year';
    if (!state.analytics.category) state.analytics.category = 'all';
    state.analytics.liveTrendType = normalizeLiveTrendType(state.analytics.liveTrendType);
    state.analytics.liveTrendMetric = normalizeLiveTrendMetric(state.analytics.liveTrendMetric);
    if (!Array.isArray(state.analytics.liveTrendRows)) state.analytics.liveTrendRows = [];
    if (!state.analytics.liveTrendRange || typeof state.analytics.liveTrendRange !== 'object') state.analytics.liveTrendRange = null;

    if (els.partnerAnalyticsPeriodType) els.partnerAnalyticsPeriodType.value = state.analytics.period;
    if (els.partnerAnalyticsMonth) els.partnerAnalyticsMonth.value = state.analytics.monthValue;
    if (els.partnerAnalyticsYear) els.partnerAnalyticsYear.value = state.analytics.yearValue;
    syncAnalyticsPeriodControls();
    syncLiveTrendControls();
  }

  function syncAnalyticsPeriodControls() {
    const period = String(state.analytics.period || 'year') === 'month' ? 'month' : 'year';
    if (els.partnerAnalyticsPeriodType) els.partnerAnalyticsPeriodType.value = period;
    els.partnerAnalyticsPeriodYearBtn?.classList.toggle('is-active', period === 'year');
    els.partnerAnalyticsPeriodMonthBtn?.classList.toggle('is-active', period === 'month');
  }

  function syncAnalyticsFilterVisibility() {
    const period = String(state.analytics.period || 'year');
    syncAnalyticsPeriodControls();
    setHidden(els.partnerAnalyticsMonthWrap, period !== 'month');
    setHidden(els.partnerAnalyticsYearWrap, period === 'month');
  }

  function getAnalyticsAllowedCategories() {
    const { canShop, canCars, canTrips, canHotels, canTransport } = getSelectedPartnerCapabilities();
    const out = [{ value: 'all', label: 'All categories' }];
    if (canShop) out.push({ value: 'shop', label: 'Shop' });
    if (canCars) out.push({ value: 'cars', label: 'Cars' });
    if (canTrips) out.push({ value: 'trips', label: 'Trips' });
    if (canHotels) out.push({ value: 'hotels', label: 'Hotels' });
    if (canTransport) out.push({ value: 'transport', label: 'Transport' });
    return out;
  }

  function syncAnalyticsCategoryOptions() {
    const select = els.partnerAnalyticsCategoryFilter;
    if (!select) return;

    const options = getAnalyticsAllowedCategories();
    const values = options.map((o) => o.value);
    if (!values.includes(String(state.analytics.category || 'all'))) {
      state.analytics.category = 'all';
    }

    setHtml(
      select,
      options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('')
    );
    select.value = String(state.analytics.category || 'all');
    renderAnalyticsCategoryChips(options);
  }

  function renderAnalyticsCategoryChips(options) {
    if (!els.partnerAnalyticsCategoryChips) return;
    const rows = Array.isArray(options) ? options : getAnalyticsAllowedCategories();
    if (!rows.length) {
      setHtml(els.partnerAnalyticsCategoryChips, '');
      return;
    }

    setHtml(
      els.partnerAnalyticsCategoryChips,
      rows.map((option) => {
        const value = String(option?.value || '').trim().toLowerCase();
        const isActive = value === String(state.analytics.category || 'all').trim().toLowerCase();
        return `<button type="button" class="partner-analytics-chip${isActive ? ' is-active' : ''}" data-analytics-category-chip="${escapeHtml(value)}">${escapeHtml(option?.label || value || 'Category')}</button>`;
      }).join('')
    );
  }

  function analyticsCategoryLabel(categoryValue) {
    const value = String(categoryValue || 'all').trim().toLowerCase();
    const match = getAnalyticsAllowedCategories().find((row) => String(row?.value || '') === value);
    if (match) return String(match.label || 'All categories');
    return 'All categories';
  }

  function normalizeLiveTrendType(value) {
    const v = String(value || 'bar').trim().toLowerCase();
    return v === 'line' ? 'line' : 'bar';
  }

  function normalizeLiveTrendMetric(value) {
    const v = String(value || 'net').trim().toLowerCase();
    if (v === 'gross') return 'gross';
    if (v === 'orders') return 'orders';
    if (v === 'sold') return 'sold';
    return 'net';
  }

  function getLiveTrendMetricConfig(metricValue) {
    const metric = normalizeLiveTrendMetric(metricValue);
    if (metric === 'gross') {
      return {
        key: 'gross',
        label: 'Gross revenue',
        type: 'money',
        getValue: (row) => toNum(row?.gross),
        accentClass: '',
      };
    }
    if (metric === 'orders') {
      return {
        key: 'orders',
        label: 'All orders',
        type: 'count',
        getValue: (row) => toNum(row?.orders),
        accentClass: '',
      };
    }
    if (metric === 'sold') {
      return {
        key: 'sold',
        label: 'Sold orders',
        type: 'count',
        getValue: (row) => toNum(row?.sold),
        accentClass: '',
      };
    }
    return {
      key: 'net',
      label: 'Net earnings',
      type: 'money',
      getValue: (row) => toNum(row?.net),
      accentClass: '',
    };
  }

  function formatLiveTrendValue(value, config, compact = false) {
    const num = toNum(value);
    if (config?.type === 'money') {
      if (!compact) return formatMoney(num, 'EUR');
      if (Math.abs(num) >= 1000) {
        return `EUR ${(num / 1000).toFixed(1)}k`;
      }
      return `EUR ${num.toFixed(0)}`;
    }
    if (compact && Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return String(Math.round(num));
  }

  function syncLiveTrendControls() {
    const chartType = normalizeLiveTrendType(state.analytics.liveTrendType);
    const metric = normalizeLiveTrendMetric(state.analytics.liveTrendMetric);
    state.analytics.liveTrendType = chartType;
    state.analytics.liveTrendMetric = metric;

    els.partnerLiveTrendTypeBarBtn?.classList.toggle('is-active', chartType === 'bar');
    els.partnerLiveTrendTypeLineBtn?.classList.toggle('is-active', chartType === 'line');
    els.partnerLiveTrendMetricNetBtn?.classList.toggle('is-active', metric === 'net');
    els.partnerLiveTrendMetricGrossBtn?.classList.toggle('is-active', metric === 'gross');
    els.partnerLiveTrendMetricOrdersBtn?.classList.toggle('is-active', metric === 'orders');
    els.partnerLiveTrendMetricSoldBtn?.classList.toggle('is-active', metric === 'sold');
  }

  function normalizeAnalyticsMonthValue(rawValue) {
    const raw = String(rawValue || '').trim();
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    return currentUtcMonthValue();
  }

  function normalizeAnalyticsYearValue(rawValue) {
    const num = Number.parseInt(String(rawValue || '').trim(), 10);
    if (Number.isFinite(num) && num >= 2020 && num <= 2100) return String(num);
    return currentUtcYearValue();
  }

  function getAnalyticsRange() {
    const period = String(state.analytics.period || 'year') === 'month' ? 'month' : 'year';

    if (period === 'year') {
      const yearText = normalizeAnalyticsYearValue(state.analytics.yearValue);
      const year = Number.parseInt(yearText, 10);
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
      return {
        period,
        label: yearText,
        fromIso: start.toISOString(),
        toIso: end.toISOString(),
      };
    }

    const monthText = normalizeAnalyticsMonthValue(state.analytics.monthValue);
    const [yearStr, monthStr] = monthText.split('-');
    const year = Number.parseInt(yearStr, 10);
    const monthIdx = Math.max(1, Math.min(12, Number.parseInt(monthStr, 10))) - 1;
    const start = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0));
    const monthLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return {
      period,
      label: monthLabel,
      fromIso: start.toISOString(),
      toIso: end.toISOString(),
    };
  }

  async function fetchPagedRows(fetchPage, pageSize = 500, maxRows = 12000) {
    const out = [];
    let from = 0;
    const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 500;
    const limitRows = Number.isFinite(maxRows) && maxRows > 0 ? Math.floor(maxRows) : 12000;

    while (out.length < limitRows) {
      const { data, error } = await fetchPage(from, size);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      out.push(...rows);
      if (rows.length < size) break;
      from += size;
    }

    if (out.length > limitRows) return out.slice(0, limitRows);
    return out;
  }

  async function fetchServiceFulfillmentsForAnalytics(fromIso, toIso) {
    const withDetailsSelect = 'id, partner_id, resource_type, booking_id, resource_id, status, created_at, accepted_at, rejected_at, reference, summary, total_price, currency, details';
    const withoutDetailsSelect = 'id, partner_id, resource_type, booking_id, resource_id, status, created_at, accepted_at, rejected_at, reference, summary, total_price, currency';
    const withDetailsLegacySelect = 'id, partner_id, resource_type, booking_id, resource_id, status, created_at, reference, summary, total_price, currency, details';
    const withoutDetailsLegacySelect = 'id, partner_id, resource_type, booking_id, resource_id, status, created_at, reference, summary, total_price, currency';

    const build = (selectText) => (from, size) => state.sb
      .from('partner_service_fulfillments')
      .select(selectText)
      .eq('partner_id', state.selectedPartnerId)
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at', { ascending: false })
      .range(from, from + size - 1);

    const selectCandidates = [
      withDetailsSelect,
      withoutDetailsSelect,
      withDetailsLegacySelect,
      withoutDetailsLegacySelect,
    ];

    let lastError = null;
    for (const selectText of selectCandidates) {
      try {
        return await fetchPagedRows(build(selectText), 400, 12000);
      } catch (error) {
        lastError = error;
        const message = String(error?.message || '');
        if (!/(details|accepted_at|rejected_at)/i.test(message)) break;
      }
    }
    throw lastError || new Error('Failed to load service fulfillments');
  }

  async function fetchShopFulfillmentsForAnalytics(fromIso, toIso) {
    const selectCandidates = [
      'id, partner_id, order_id, order_number, status, created_at, accepted_at, rejected_at, subtotal, total_allocated',
      'id, partner_id, order_id, order_number, status, created_at, subtotal, total_allocated',
    ];

    let lastError = null;
    for (const selectText of selectCandidates) {
      try {
        return await fetchPagedRows((from, size) => state.sb
          .from('shop_order_fulfillments')
          .select(selectText)
          .eq('partner_id', state.selectedPartnerId)
          .gte('created_at', fromIso)
          .lt('created_at', toIso)
          .order('created_at', { ascending: false })
          .range(from, from + size - 1), 400, 12000);
      } catch (error) {
        lastError = error;
        const message = String(error?.message || '');
        if (!/(accepted_at|rejected_at)/i.test(message)) break;
      }
    }
    throw lastError || new Error('Failed to load shop fulfillments');
  }

  function chunkValues(values, size = 100) {
    const src = Array.isArray(values) ? values : [];
    const out = [];
    const step = Number.isFinite(size) && size > 0 ? Math.floor(size) : 100;
    for (let i = 0; i < src.length; i += step) {
      out.push(src.slice(i, i + step));
    }
    return out;
  }

  async function fetchShopItemsForFulfillments(fulfillmentIds) {
    const ids = Array.isArray(fulfillmentIds) ? fulfillmentIds.map((v) => String(v || '').trim()).filter(Boolean) : [];
    if (!ids.length) return [];

    const out = [];
    for (const idChunk of chunkValues(ids, 100)) {
      const rows = await fetchPagedRows((from, size) => state.sb
        .from('shop_order_fulfillment_items')
        .select('fulfillment_id, product_name, variant_name, quantity, subtotal')
        .in('fulfillment_id', idChunk)
        .range(from, from + size - 1), 500, 10000);
      out.push(...rows);
    }
    return out;
  }

  async function fetchServiceDepositByFulfillment(fulfillmentIds) {
    const idSet = new Set((Array.isArray(fulfillmentIds) ? fulfillmentIds : []).map((id) => String(id || '').trim()).filter(Boolean));
    if (!idSet.size) return {};

    const out = {};
    try {
      const { data, error } = await state.sb.rpc('partner_get_service_deposit_amounts', {
        p_partner_id: state.selectedPartnerId,
      });
      if (error) throw error;
      (data || []).forEach((row) => {
        const fid = String(row?.fulfillment_id || '').trim();
        if (!fid || !idSet.has(fid)) return;
        out[fid] = toNum(row?.amount);
      });
    } catch (_e) {
    }
    return out;
  }

  function analyticsBucketKeyFromDate(rawValue, period) {
    const dt = new Date(rawValue || '');
    if (Number.isNaN(dt.getTime())) return '';
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    if (period === 'year') return `${y}-${m}`;
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function analyticsLabelFromBucket(bucket, period) {
    if (!bucket) return '—';
    if (period === 'year') {
      const dt = new Date(`${bucket}-01T00:00:00Z`);
      if (Number.isNaN(dt.getTime())) return bucket;
      return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    const dt = new Date(`${bucket}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return bucket;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function analyticsTypeLabel(type) {
    const t = String(type || '').trim().toLowerCase();
    if (t === 'shop') return 'Shop';
    if (t === 'cars') return 'Cars';
    if (t === 'trips') return 'Trips';
    if (t === 'hotels') return 'Hotels';
    if (t === 'transport') return 'Transport';
    return 'Other';
  }

  function isServiceSoldStatus(row) {
    const status = resolveServiceOrderStatus(row);
    return status === 'confirmed' || status === 'completed';
  }

  function serviceGrossAmount(row) {
    const type = String(row?.resource_type || '').trim().toLowerCase();
    if (type === 'cars') {
      return toNum(getCarsFulfillmentPricing(row).amount);
    }
    return toNum(row?.total_price);
  }

  function serviceMatchesCategory(row, category) {
    const cat = String(category || 'all').trim().toLowerCase();
    if (cat === 'all') return true;
    if (cat === 'shop') return false;
    return String(row?.resource_type || '').trim().toLowerCase() === cat;
  }

  function shopMatchesCategory(category) {
    const cat = String(category || 'all').trim().toLowerCase();
    return cat === 'all' || cat === 'shop';
  }

  function setPartnerAnalyticsLoadingState(message) {
    const msg = String(message || 'Loading analytics…');
    setText(els.partnerAnalyticsStatus, msg);
    if (els.partnerAnalyticsLiveChart) {
      setHtml(els.partnerAnalyticsLiveChart, '<div class="partner-analytics-live-chart__empty">Loading chart…</div>');
    }
    if (els.partnerAnalyticsResponseChart) {
      setHtml(els.partnerAnalyticsResponseChart, '<div class="partner-analytics-live-chart__empty">Loading response chart…</div>');
    }
    if (els.partnerAnalyticsByTypeBody) setHtml(els.partnerAnalyticsByTypeBody, '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">Loading…</td></tr>');
    if (els.partnerAnalyticsTimeseriesBody) setHtml(els.partnerAnalyticsTimeseriesBody, '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">Loading…</td></tr>');
    if (els.partnerAnalyticsTopOffersBody) setHtml(els.partnerAnalyticsTopOffersBody, '<tr><td colspan="4" class="muted" style="padding: 16px 8px;">Loading…</td></tr>');
    if (els.partnerAnalyticsTopProductsBody) setHtml(els.partnerAnalyticsTopProductsBody, '<tr><td colspan="4" class="muted" style="padding: 16px 8px;">Loading…</td></tr>');
  }

  function reduceTimeseriesForChart(rows, maxPoints = 18) {
    const src = Array.isArray(rows) ? rows : [];
    const limit = Number.isFinite(maxPoints) && maxPoints > 0 ? Math.floor(maxPoints) : 18;
    if (src.length <= limit) return src;

    const bucketSize = Math.ceil(src.length / limit);
    const out = [];
    for (let i = 0; i < src.length; i += bucketSize) {
      const chunk = src.slice(i, i + bucketSize);
      if (!chunk.length) continue;
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      out.push({
        bucket: last?.bucket || first?.bucket || '',
        bucketStart: first?.bucket || '',
        orders: chunk.reduce((sum, row) => sum + toNum(row?.orders), 0),
        sold: chunk.reduce((sum, row) => sum + toNum(row?.sold), 0),
        gross: chunk.reduce((sum, row) => sum + toNum(row?.gross), 0),
        net: chunk.reduce((sum, row) => sum + toNum(row?.net), 0),
      });
    }
    return out;
  }

  function renderAnalyticsLiveChart(timeseriesRows, range) {
    if (!els.partnerAnalyticsLiveChart) return;
    const rows = reduceTimeseriesForChart(timeseriesRows, range?.period === 'year' ? 12 : 16);
    const chartType = normalizeLiveTrendType(state.analytics.liveTrendType);
    const metricConfig = getLiveTrendMetricConfig(state.analytics.liveTrendMetric);
    syncLiveTrendControls();

    state.analytics.liveTrendRows = rows;
    state.analytics.liveTrendRange = range ? { period: range.period, label: range.label } : null;

    const categoryText = analyticsCategoryLabel(state.analytics.category);
    setText(
      els.partnerAnalyticsLiveTrendHint,
      `${metricConfig.label} • ${categoryText} • ${chartType === 'line' ? 'Line chart' : 'Bar chart'}`
    );

    if (!rows.length) {
      setHtml(els.partnerAnalyticsLiveChart, '<div class="partner-analytics-live-chart__empty">No trend data for this range.</div>');
      return;
    }

    const values = rows.map((row) => metricConfig.getValue(row));
    const maxValue = values.reduce((max, value) => Math.max(max, toNum(value)), 0);
    const safeMaxValue = maxValue > 0 ? maxValue : 1;
    const totalValue = values.reduce((sum, value) => sum + toNum(value), 0);
    const avgValue = rows.length ? (totalValue / rows.length) : 0;
    const maxOrders = rows.reduce((max, row) => Math.max(max, toNum(row?.orders)), 0);

    const bars = rows.map((row, index) => {
      const value = toNum(values[index]);
      const heightPct = Math.max(4, Math.min(100, Math.round((value / safeMaxValue) * 100)));
      const label = analyticsLabelFromBucket(row?.bucket, range?.period);
      const shortLabel = label.split(' ')[0];
      const delay = Math.min(index * 36, 540);
      return `
        <div class="partner-analytics-live-chart__col" title="${escapeHtml(label)}: ${escapeHtml(formatLiveTrendValue(value, metricConfig, false))}">
          <div class="partner-analytics-live-chart__bar-wrap">
            <div class="partner-analytics-live-chart__bar" style="height:${heightPct}%; --bar-delay:${delay}ms;"></div>
          </div>
          <div class="partner-analytics-live-chart__orders">${escapeHtml(formatLiveTrendValue(value, metricConfig, true))}</div>
          <div class="partner-analytics-live-chart__label">${escapeHtml(shortLabel)}</div>
        </div>
      `;
    }).join('');

    const linePoints = rows.map((row, index) => {
      const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
      const yRaw = 100 - ((toNum(values[index]) / safeMaxValue) * 100);
      const y = Number.isFinite(yRaw) ? Math.max(0, Math.min(100, yRaw)) : 100;
      return { x, y, label: analyticsLabelFromBucket(row?.bucket, range?.period), value: toNum(values[index]) };
    });
    const polylinePoints = linePoints.length === 1
      ? `0,${linePoints[0].y.toFixed(2)} 100,${linePoints[0].y.toFixed(2)}`
      : linePoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const areaPoints = `0,100 ${polylinePoints} 100,100`;

    const lineChartHtml = `
      <div class="partner-analytics-live-chart__line-wrap">
        <svg class="partner-analytics-live-chart__line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Live trend line chart">
          <line class="partner-analytics-live-chart__line-grid" x1="0" y1="25" x2="100" y2="25"></line>
          <line class="partner-analytics-live-chart__line-grid" x1="0" y1="50" x2="100" y2="50"></line>
          <line class="partner-analytics-live-chart__line-grid" x1="0" y1="75" x2="100" y2="75"></line>
          <polygon class="partner-analytics-live-chart__line-area" points="${areaPoints}"></polygon>
          <polyline class="partner-analytics-live-chart__line-path" points="${polylinePoints}"></polyline>
          ${linePoints.map((point) => `<circle class="partner-analytics-live-chart__line-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="1.9"></circle>`).join('')}
        </svg>
      </div>
      <div class="partner-analytics-live-chart__line-values" style="grid-template-columns: repeat(${linePoints.length}, minmax(0, 1fr));">
        ${linePoints.map((point) => `<span title="${escapeHtml(formatLiveTrendValue(point.value, metricConfig, false))}">${escapeHtml(formatLiveTrendValue(point.value, metricConfig, true))}</span>`).join('')}
      </div>
      <div class="partner-analytics-live-chart__line-labels" style="grid-template-columns: repeat(${linePoints.length}, minmax(0, 1fr));">
        ${linePoints.map((point) => `<span>${escapeHtml(point.label.split(' ')[0])}</span>`).join('')}
      </div>
    `;

    setHtml(
      els.partnerAnalyticsLiveChart,
      `
        <div class="partner-analytics-live-chart__metrics">
          <span>Total ${escapeHtml(metricConfig.label.toLowerCase())}<strong>${escapeHtml(formatLiveTrendValue(totalValue, metricConfig, false))}</strong></span>
          <span>Average<strong>${escapeHtml(formatLiveTrendValue(avgValue, metricConfig, false))}</strong></span>
          <span>Peak<strong>${escapeHtml(formatLiveTrendValue(maxValue, metricConfig, false))}</strong></span>
          <span>Orders peak<strong>${Math.max(0, Math.round(maxOrders))}</strong></span>
        </div>
        ${chartType === 'line'
    ? lineChartHtml
    : `
            <div class="partner-analytics-live-chart__bars" style="grid-template-columns: repeat(${rows.length}, minmax(0, 1fr));">
              ${bars}
            </div>
          `}
      `
    );
  }

  function rerenderAnalyticsLiveTrendFromCache() {
    if (!els.partnerAnalyticsView || els.partnerAnalyticsView.hidden) return;
    const rows = Array.isArray(state.analytics.liveTrendRows) ? state.analytics.liveTrendRows : [];
    const range = state.analytics.liveTrendRange && typeof state.analytics.liveTrendRange === 'object'
      ? state.analytics.liveTrendRange
      : getAnalyticsRange();
    renderAnalyticsLiveChart(rows, range);
  }

  function formatResponseMinutes(minutesValue) {
    const minutes = Math.max(0, Math.round(toNum(minutesValue)));
    if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (!remHours) return `${days}d`;
    return `${days}d ${remHours}h`;
  }

  function parseIsoMs(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : null;
  }

  function responseMinutesFromFulfillment(row) {
    const createdMs = parseIsoMs(row?.created_at);
    if (!Number.isFinite(createdMs)) return null;

    const acceptedMs = parseIsoMs(row?.accepted_at);
    const rejectedMs = parseIsoMs(row?.rejected_at);
    let decisionMs = null;
    if (Number.isFinite(acceptedMs) && Number.isFinite(rejectedMs)) decisionMs = Math.min(acceptedMs, rejectedMs);
    else if (Number.isFinite(acceptedMs)) decisionMs = acceptedMs;
    else if (Number.isFinite(rejectedMs)) decisionMs = rejectedMs;
    if (!Number.isFinite(decisionMs)) return null;

    const diffMinutes = (decisionMs - createdMs) / 60000;
    if (!Number.isFinite(diffMinutes) || diffMinutes < 0) return null;
    return diffMinutes;
  }

  function reduceResponseSeriesForChart(rows, maxPoints = 18) {
    const src = Array.isArray(rows) ? rows : [];
    const limit = Number.isFinite(maxPoints) && maxPoints > 0 ? Math.floor(maxPoints) : 18;
    if (src.length <= limit) return src;

    const bucketSize = Math.ceil(src.length / limit);
    const out = [];
    for (let i = 0; i < src.length; i += bucketSize) {
      const chunk = src.slice(i, i + bucketSize);
      if (!chunk.length) continue;
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const decisions = chunk.reduce((sum, row) => sum + toNum(row?.decisions), 0);
      const totalMinutes = chunk.reduce((sum, row) => sum + toNum(row?.totalMinutes), 0);
      out.push({
        bucket: last?.bucket || first?.bucket || '',
        decisions,
        totalMinutes,
        avgMinutes: decisions > 0 ? (totalMinutes / decisions) : 0,
      });
    }
    return out;
  }

  function renderAnalyticsResponseChart(responseRows, range) {
    if (!els.partnerAnalyticsResponseChart) return;
    const rows = reduceResponseSeriesForChart(responseRows, range?.period === 'year' ? 12 : 16);

    if (!rows.length) {
      setHtml(els.partnerAnalyticsResponseChart, '<div class="partner-analytics-live-chart__empty">No response actions in this range.</div>');
      return;
    }

    const maxAvg = rows.reduce((max, row) => Math.max(max, toNum(row?.avgMinutes)), 0);
    const safeMaxAvg = maxAvg > 0 ? maxAvg : 1;
    const totalDecisions = rows.reduce((sum, row) => sum + toNum(row?.decisions), 0);
    const totalMinutes = rows.reduce((sum, row) => sum + toNum(row?.totalMinutes), 0);
    const overallAvg = totalDecisions > 0 ? (totalMinutes / totalDecisions) : 0;
    const positiveAvgValues = rows
      .map((row) => toNum(row?.avgMinutes))
      .filter((value) => Number.isFinite(value) && value > 0);
    const bestAvg = positiveAvgValues.length ? Math.min(...positiveAvgValues) : 0;

    const bars = rows.map((row, index) => {
      const avgMinutes = toNum(row?.avgMinutes);
      const decisions = toNum(row?.decisions);
      const heightPct = Math.max(4, Math.min(100, Math.round((avgMinutes / safeMaxAvg) * 100)));
      const label = analyticsLabelFromBucket(row?.bucket, range?.period);
      const shortLabel = label.split(' ')[0];
      const delay = Math.min(index * 36, 540);
      return `
        <div class="partner-analytics-live-chart__col" title="${escapeHtml(label)}: ${escapeHtml(formatResponseMinutes(avgMinutes))}, ${decisions} decisions">
          <div class="partner-analytics-live-chart__bar-wrap">
            <div class="partner-analytics-live-chart__bar partner-analytics-live-chart__bar--response" style="height:${heightPct}%; --bar-delay:${delay}ms;"></div>
          </div>
          <div class="partner-analytics-live-chart__orders">${escapeHtml(formatResponseMinutes(avgMinutes))}</div>
          <div class="partner-analytics-live-chart__label">${escapeHtml(shortLabel)}</div>
        </div>
      `;
    }).join('');

    setHtml(
      els.partnerAnalyticsResponseChart,
      `
        <div class="partner-analytics-live-chart__metrics">
          <span>Average<strong>${escapeHtml(formatResponseMinutes(overallAvg))}</strong></span>
          <span>Decisions<strong>${totalDecisions}</strong></span>
          <span>Best<strong>${escapeHtml(formatResponseMinutes(bestAvg))}</strong></span>
          <span>Slowest<strong>${escapeHtml(formatResponseMinutes(maxAvg))}</strong></span>
        </div>
        <div class="partner-analytics-live-chart__bars" style="grid-template-columns: repeat(${rows.length}, minmax(0, 1fr));">
          ${bars}
        </div>
      `
    );
  }

  function fillAnalyticsKpis(values) {
    const v = values || {};
    setText(els.partnerAnalyticsKpiGross, formatMoney(toNum(v.gross), 'EUR'));
    setText(els.partnerAnalyticsKpiNet, formatMoney(toNum(v.net), 'EUR'));
    setText(els.partnerAnalyticsKpiSold, String(toNum(v.sold)));
    setText(els.partnerAnalyticsKpiTotal, String(toNum(v.total)));
    setText(els.partnerAnalyticsKpiAvg, formatMoney(toNum(v.avg), 'EUR'));
    setText(els.partnerAnalyticsKpiPending, String(toNum(v.pending)));
    setText(els.partnerAnalyticsKpiAwaiting, String(toNum(v.awaiting)));
    setText(els.partnerAnalyticsKpiCancelled, String(toNum(v.cancelled)));
    setText(els.partnerAnalyticsKpiResponseAvg, toNum(v.responseCount) > 0 ? formatResponseMinutes(v.avgResponseMinutes) : '—');
    setText(els.partnerAnalyticsKpiResponseCount, String(toNum(v.responseCount)));
  }

  async function refreshPartnerAnalyticsView(options = {}) {
    const { silent = false } = options;
    if (!state.sb || !state.selectedPartnerId) return;
    if (!els.partnerAnalyticsView || els.partnerAnalyticsView.hidden) return;
    if (!partnerCanAccessAnalytics()) {
      if (!silent) showToast('Analytics is not available for this partner.', 'info');
      return;
    }

    ensureAnalyticsFilterDefaults();
    syncAnalyticsCategoryOptions();
    syncAnalyticsFilterVisibility();
    setPartnerAnalyticsLoadingState('Loading analytics…');

    const periodRaw = String(state.analytics.period || 'year').trim().toLowerCase();
    state.analytics.period = periodRaw === 'month' ? 'month' : 'year';
    state.analytics.monthValue = normalizeAnalyticsMonthValue(state.analytics.monthValue);
    state.analytics.yearValue = normalizeAnalyticsYearValue(state.analytics.yearValue);
    state.analytics.category = String(state.analytics.category || 'all').trim().toLowerCase();

    const range = getAnalyticsRange();
    setText(els.partnerAnalyticsRangeLabel, `Range: ${range.label}`);

    try {
      const { canShop } = getSelectedPartnerCapabilities();
      const selectedCategory = String(state.analytics.category || 'all').trim().toLowerCase();
      const [serviceRowsRaw, shopRowsRaw] = await Promise.all([
        selectedCategory === 'shop' ? Promise.resolve([]) : fetchServiceFulfillmentsForAnalytics(range.fromIso, range.toIso),
        canShop && shopMatchesCategory(selectedCategory)
          ? fetchShopFulfillmentsForAnalytics(range.fromIso, range.toIso)
          : Promise.resolve([]),
      ]);

      const serviceRows = Array.isArray(serviceRowsRaw) ? serviceRowsRaw : [];
      const shopRows = Array.isArray(shopRowsRaw) ? shopRowsRaw : [];

      const bookingStateByKey = await loadServiceBookingStateByKey(serviceRows);
      const serviceRowsEnriched = serviceRows.map((row) => {
        const type = String(row?.resource_type || '').trim().toLowerCase();
        const bookingId = String(row?.booking_id || '').trim();
        const bookingState = bookingStateByKey[`${type}:${bookingId}`] || null;
        return {
          ...row,
          booking_status: bookingState?.status || null,
          booking_payment_status: bookingState?.paymentStatus || null,
        };
      });

      const filteredServiceRows = serviceRowsEnriched.filter((row) => serviceMatchesCategory(row, selectedCategory));
      const filteredShopRows = shopRows;
      const soldServiceIds = filteredServiceRows.filter((row) => isServiceSoldStatus(row)).map((row) => row.id).filter(Boolean);
      const serviceDepositByFid = await fetchServiceDepositByFulfillment(soldServiceIds);

      const summary = {
        total: 0,
        sold: 0,
        pending: 0,
        awaiting: 0,
        cancelled: 0,
        gross: 0,
        net: 0,
        responseMinutes: 0,
        responseCount: 0,
      };

      const byType = {
        shop: { type: 'shop', orders: 0, sold: 0, gross: 0, net: 0 },
        cars: { type: 'cars', orders: 0, sold: 0, gross: 0, net: 0 },
        trips: { type: 'trips', orders: 0, sold: 0, gross: 0, net: 0 },
        hotels: { type: 'hotels', orders: 0, sold: 0, gross: 0, net: 0 },
      };

      const topServices = {};
      const topShopProducts = {};

      const timeseries = {};
      const ensureTsRow = (bucketKey) => {
        if (!bucketKey) return null;
        if (!timeseries[bucketKey]) {
          timeseries[bucketKey] = { bucket: bucketKey, orders: 0, sold: 0, gross: 0, net: 0 };
        }
        return timeseries[bucketKey];
      };

      const responseSeries = {};
      const ensureResponseRow = (bucketKey) => {
        if (!bucketKey) return null;
        if (!responseSeries[bucketKey]) {
          responseSeries[bucketKey] = { bucket: bucketKey, decisions: 0, totalMinutes: 0, avgMinutes: 0 };
        }
        return responseSeries[bucketKey];
      };

      const recordResponseMetric = (bucketKey, responseMinutes) => {
        const minutes = toNum(responseMinutes);
        if (!Number.isFinite(minutes) || minutes < 0) return;
        summary.responseMinutes += minutes;
        summary.responseCount += 1;
        const bucket = ensureResponseRow(bucketKey);
        if (!bucket) return;
        bucket.decisions += 1;
        bucket.totalMinutes += minutes;
      };

      filteredServiceRows.forEach((row) => {
        const fStatusRaw = String(row?.status || '').trim().toLowerCase();
        const resolvedStatus = resolveServiceOrderStatus(row);
        const type = String(row?.resource_type || '').trim().toLowerCase();
        const typeAgg = byType[type] || null;
        const bucket = ensureTsRow(analyticsBucketKeyFromDate(row?.created_at, range.period));
        const responseBucketKey = analyticsBucketKeyFromDate(row?.created_at, range.period);

        summary.total += 1;
        if (typeAgg) typeAgg.orders += 1;
        if (bucket) bucket.orders += 1;

        const responseMinutes = responseMinutesFromFulfillment(row);
        if (responseMinutes != null) {
          recordResponseMetric(responseBucketKey, responseMinutes);
        }

        const isAwaiting = fStatusRaw === 'awaiting_payment';
        const isPending = !isAwaiting && resolvedStatus === 'pending';
        const isCancelled = resolvedStatus === 'cancelled' || fStatusRaw === 'rejected' || fStatusRaw === 'expired';
        const isSold = isServiceSoldStatus(row);

        if (isAwaiting) summary.awaiting += 1;
        if (isPending) summary.pending += 1;
        if (isCancelled) summary.cancelled += 1;

        if (isSold) {
          const gross = serviceGrossAmount(row);
          const deposit = toNum(serviceDepositByFid[String(row?.id || '')] || 0);
          const net = Math.max(0, gross - deposit);

          summary.sold += 1;
          summary.gross += gross;
          summary.net += net;
          if (bucket) {
            bucket.sold += 1;
            bucket.gross += gross;
            bucket.net += net;
          }
          if (typeAgg) {
            typeAgg.sold += 1;
            typeAgg.gross += gross;
            typeAgg.net += net;
          }

          const serviceTypeLabel = analyticsTypeLabel(type);
          const serviceLabel = String(row?.summary || '').trim() || `${serviceTypeLabel} ${String(row?.resource_id || row?.booking_id || row?.id || '').slice(0, 8)}`;
          const key = `${type}:${String(row?.resource_id || row?.summary || row?.booking_id || row?.id || '')}`;
          if (!topServices[key]) {
            topServices[key] = {
              label: serviceLabel,
              sold: 0,
              gross: 0,
              net: 0,
            };
          }
          topServices[key].sold += 1;
          topServices[key].gross += gross;
          topServices[key].net += net;
        }
      });

      const soldShopRows = filteredShopRows.filter((row) => String(row?.status || '').trim().toLowerCase() === 'accepted');
      const soldShopIdSet = new Set(soldShopRows.map((row) => String(row?.id || '').trim()).filter(Boolean));
      const soldShopIds = Array.from(soldShopIdSet);

      filteredShopRows.forEach((row) => {
        const status = String(row?.status || '').trim().toLowerCase();
        const bucket = ensureTsRow(analyticsBucketKeyFromDate(row?.created_at, range.period));
        const responseBucketKey = analyticsBucketKeyFromDate(row?.created_at, range.period);

        summary.total += 1;
        byType.shop.orders += 1;
        if (bucket) bucket.orders += 1;

        const responseMinutes = responseMinutesFromFulfillment(row);
        if (responseMinutes != null) {
          recordResponseMetric(responseBucketKey, responseMinutes);
        }

        const isAwaiting = status === 'awaiting_payment';
        const isPending = status === 'pending_acceptance';
        const isCancelled = status === 'rejected' || status === 'expired';
        const isSold = status === 'accepted';

        if (isAwaiting) summary.awaiting += 1;
        if (isPending) summary.pending += 1;
        if (isCancelled) summary.cancelled += 1;

        if (isSold) {
          const gross = toNum(row?.subtotal);
          const allocatedRaw = Number(row?.total_allocated);
          const net = Number.isFinite(allocatedRaw) ? allocatedRaw : gross;

          summary.sold += 1;
          summary.gross += gross;
          summary.net += net;
          if (bucket) {
            bucket.sold += 1;
            bucket.gross += gross;
            bucket.net += net;
          }
          byType.shop.sold += 1;
          byType.shop.gross += gross;
          byType.shop.net += net;
        }
      });

      if (soldShopIds.length) {
        const shopItems = await fetchShopItemsForFulfillments(soldShopIds);
        shopItems.forEach((item) => {
          const fid = String(item?.fulfillment_id || '').trim();
          if (!fid || !soldShopIdSet.has(fid)) return;

          const name = String(item?.product_name || '').trim() || 'Product';
          const variant = String(item?.variant_name || '').trim();
          const label = variant ? `${name} (${variant})` : name;
          const key = `${name}::${variant}`;

          if (!topShopProducts[key]) {
            topShopProducts[key] = {
              label,
              units: 0,
              ordersSet: new Set(),
              revenue: 0,
            };
          }

          topShopProducts[key].units += toNum(item?.quantity || 0);
          topShopProducts[key].ordersSet.add(fid);
          topShopProducts[key].revenue += toNum(item?.subtotal || 0);
        });
      }

      summary.gross = Number(summary.gross.toFixed(2));
      summary.net = Number(summary.net.toFixed(2));
      summary.avg = summary.sold > 0 ? Number((summary.gross / summary.sold).toFixed(2)) : 0;
      summary.avgResponseMinutes = summary.responseCount > 0
        ? Number((summary.responseMinutes / summary.responseCount).toFixed(2))
        : 0;

      fillAnalyticsKpis(summary);

      const byTypeRows = Object.values(byType)
        .filter((row) => {
          if (selectedCategory !== 'all' && row.type !== selectedCategory) return false;
          return row.orders > 0 || row.sold > 0 || row.gross > 0 || row.net > 0;
        })
        .sort((a, b) => (b.net - a.net) || (b.gross - a.gross) || (b.sold - a.sold));

      setHtml(
        els.partnerAnalyticsByTypeBody,
        byTypeRows.length
          ? byTypeRows.map((row) => `
            <tr>
              <td>${escapeHtml(analyticsTypeLabel(row.type))}</td>
              <td style="text-align:right;">${Number(row.orders || 0)}</td>
              <td style="text-align:right;">${Number(row.sold || 0)}</td>
              <td style="text-align:right;">${escapeHtml(formatMoney(row.gross || 0, 'EUR'))}</td>
              <td style="text-align:right;"><strong>${escapeHtml(formatMoney(row.net || 0, 'EUR'))}</strong></td>
            </tr>
          `).join('')
          : '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">No category data for this range.</td></tr>'
      );

      const timeseriesRows = Object.values(timeseries)
        .sort((a, b) => String(a.bucket || '').localeCompare(String(b.bucket || '')));
      const responseRows = Object.values(responseSeries)
        .map((row) => ({
          ...row,
          avgMinutes: row.decisions > 0 ? Number((row.totalMinutes / row.decisions).toFixed(2)) : 0,
        }))
        .sort((a, b) => String(a.bucket || '').localeCompare(String(b.bucket || '')));

      renderAnalyticsLiveChart(timeseriesRows, range);
      renderAnalyticsResponseChart(responseRows, range);

      setHtml(
        els.partnerAnalyticsTimeseriesBody,
        timeseriesRows.length
          ? timeseriesRows.map((row) => `
            <tr>
              <td>${escapeHtml(analyticsLabelFromBucket(row.bucket, range.period))}</td>
              <td style="text-align:right;">${Number(row.orders || 0)}</td>
              <td style="text-align:right;">${Number(row.sold || 0)}</td>
              <td style="text-align:right;">${escapeHtml(formatMoney(row.gross || 0, 'EUR'))}</td>
              <td style="text-align:right;"><strong>${escapeHtml(formatMoney(row.net || 0, 'EUR'))}</strong></td>
            </tr>
          `).join('')
          : '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">No time-series data for this range.</td></tr>'
      );

      const topServiceRows = Object.values(topServices)
        .sort((a, b) => (toNum(b.net) - toNum(a.net)) || (toNum(b.gross) - toNum(a.gross)) || (toNum(b.sold) - toNum(a.sold)))
        .slice(0, 10);
      setHtml(
        els.partnerAnalyticsTopOffersBody,
        topServiceRows.length
          ? topServiceRows.map((row) => `
            <tr>
              <td>${escapeHtml(row.label || '—')}</td>
              <td style="text-align:right;">${Number(row.sold || 0)}</td>
              <td style="text-align:right;">${escapeHtml(formatMoney(row.gross || 0, 'EUR'))}</td>
              <td style="text-align:right;"><strong>${escapeHtml(formatMoney(row.net || 0, 'EUR'))}</strong></td>
            </tr>
          `).join('')
          : '<tr><td colspan="4" class="muted" style="padding: 16px 8px;">No sold services in this range.</td></tr>'
      );

      const topProductRows = Object.values(topShopProducts)
        .map((row) => ({
          label: row.label,
          units: Number(row.units || 0),
          orders: row.ordersSet instanceof Set ? row.ordersSet.size : 0,
          revenue: Number((row.revenue || 0).toFixed(2)),
        }))
        .sort((a, b) => (toNum(b.revenue) - toNum(a.revenue)) || (toNum(b.units) - toNum(a.units)))
        .slice(0, 10);

      setHtml(
        els.partnerAnalyticsTopProductsBody,
        topProductRows.length
          ? topProductRows.map((row) => `
            <tr>
              <td>${escapeHtml(row.label || '—')}</td>
              <td style="text-align:right;">${Number(row.units || 0)}</td>
              <td style="text-align:right;">${Number(row.orders || 0)}</td>
              <td style="text-align:right;"><strong>${escapeHtml(formatMoney(row.revenue || 0, 'EUR'))}</strong></td>
            </tr>
          `).join('')
          : '<tr><td colspan="4" class="muted" style="padding: 16px 8px;">No sold shop products in this range.</td></tr>'
      );

      setHidden(els.partnerAnalyticsTopOffersCard, topServiceRows.length === 0 && selectedCategory === 'shop');
      const hideTopProducts = !canShop || (topProductRows.length === 0 && selectedCategory !== 'shop' && selectedCategory !== 'all');
      setHidden(els.partnerAnalyticsTopProductsCard, hideTopProducts);

      const updatedAt = new Date().toLocaleString('en-GB');
      setText(els.partnerAnalyticsStatus, `Updated: ${updatedAt}`);
    } catch (error) {
      console.error(error);
      fillAnalyticsKpis({
        gross: 0,
        net: 0,
        sold: 0,
        total: 0,
        avg: 0,
        pending: 0,
        awaiting: 0,
        cancelled: 0,
        responseCount: 0,
        avgResponseMinutes: 0,
      });
      renderAnalyticsLiveChart([], range);
      renderAnalyticsResponseChart([], range);
      setText(els.partnerAnalyticsStatus, partnerUserMessage(error, 'Failed to load analytics.'));
      if (!silent) {
        showToast(`Error: ${error.message || 'Failed to load analytics'}`, 'error');
      }
    }
  }

  async function callFulfillmentAction(fulfillmentId, action, reason, reasonCode, extraPayload) {
    const extra = (extraPayload && typeof extraPayload === 'object') ? extraPayload : {};
    const { data, error } = await state.sb.functions.invoke('partner-fulfillment-action', {
      body: {
        fulfillment_id: fulfillmentId,
        action,
        reason: reason || undefined,
        reason_code: reasonCode || undefined,
        ...extra,
      },
    });
    if (error) {
      const msg = error.message || 'Request failed';
      throw new Error(msg);
    }
    return data;
  }

  async function callServiceFulfillmentAction(fulfillmentId, action, reason, reasonCode, extraPayload) {
    return callFulfillmentAction(fulfillmentId, action, reason, reasonCode, extraPayload);
  }

  async function dispatchTripDateOptionsToCustomer(fulfillmentId, bookingId) {
    const fid = String(fulfillmentId || '').trim();
    const bid = String(bookingId || '').trim();
    if (!fid && !bid) return { ok: false, error: 'Missing fulfillment reference' };

    const payload = {
      action: 'send_options',
      fulfillment_id: fid || undefined,
      booking_id: bid || undefined,
    };

    const { data, error } = await state.sb.functions.invoke('trip-date-selection', { body: payload });
    if (error) throw new Error(String(error.message || 'Failed to send date options'));
    if (data && typeof data === 'object' && data.error) {
      throw new Error(String(data.error || 'Failed to send date options'));
    }
    return { ok: true, data: data || null };
  }

  function promptTransportRejectReason() {
    const optionsText = [
      'Select reject reason:',
      '1 - No availability in selected time',
      '2 - Vehicle unavailable',
      '3 - Outside operating hours',
      '4 - Route not supported',
      '5 - Other (enter custom reason)',
      '',
      'Enter 1-5',
    ].join('\n');

    const choiceRaw = prompt(optionsText);
    if (choiceRaw == null) return null;
    const choice = String(choiceRaw || '').trim();

    const codeMap = {
      '1': 'no_availability',
      '2': 'vehicle_unavailable',
      '3': 'outside_operating_hours',
      '4': 'route_not_supported',
      '5': 'other',
      no_availability: 'no_availability',
      vehicle_unavailable: 'vehicle_unavailable',
      outside_operating_hours: 'outside_operating_hours',
      route_not_supported: 'route_not_supported',
      other: 'other',
    };

    const reasonCode = codeMap[String(choice).toLowerCase()] || '';
    if (!reasonCode) {
      showToast('Select valid reject reason (1-5).', 'error');
      return null;
    }

    if (reasonCode === 'other') {
      const custom = prompt('Provide reject details:');
      const reason = String(custom || '').trim();
      if (!reason) {
        showToast('Custom reject reason is required.', 'error');
        return null;
      }
      return { reason, reasonCode };
    }

    const note = prompt('Optional note for admin (optional):');
    return {
      reason: String(note || '').trim(),
      reasonCode,
    };
  }

  function isIsoWithinRange(iso, minIso, maxIso) {
    const value = normalizeIsoDateValue(iso);
    if (!value) return false;
    const min = normalizeIsoDateValue(minIso);
    const max = normalizeIsoDateValue(maxIso);
    if (min && value < min) return false;
    if (max && value > max) return false;
    return true;
  }

  function getTripDateContextFromFulfillment(row) {
    const details = detailsObjectFromFulfillment(row) || {};
    const preferredIso = firstIsoFromCandidates([
      details?.preferred_date,
      details?.preferredDate,
      details?.trip_date,
      details?.tripDate,
      row?.start_date,
    ]);
    const arrivalIso = firstIsoFromCandidates([
      details?.arrival_date,
      details?.arrivalDate,
      details?.start_date,
      details?.startDate,
      row?.start_date,
    ]);
    const departureIso = firstIsoFromCandidates([
      details?.departure_date,
      details?.departureDate,
      details?.end_date,
      details?.endDate,
      row?.end_date,
      arrivalIso,
    ]);

    let minIso = arrivalIso || preferredIso || '';
    let maxIso = departureIso || arrivalIso || preferredIso || '';
    if (minIso && maxIso && minIso > maxIso) {
      const tmp = minIso;
      minIso = maxIso;
      maxIso = tmp;
    }
    return {
      preferredIso: normalizeIsoDateValue(preferredIso),
      arrivalIso: normalizeIsoDateValue(arrivalIso),
      departureIso: normalizeIsoDateValue(departureIso),
      minIso: normalizeIsoDateValue(minIso),
      maxIso: normalizeIsoDateValue(maxIso),
    };
  }

  function normalizeTripProposedDateList(values, minIso, maxIso) {
    const out = [];
    const seen = new Set();
    const list = Array.isArray(values) ? values : [];
    for (const raw of list) {
      const iso = normalizeIsoDateValue(raw);
      if (!iso) continue;
      if (!isIsoWithinRange(iso, minIso, maxIso)) {
        return { ok: false, error: `Date ${iso} is outside customer stay window.` };
      }
      if (seen.has(iso)) continue;
      seen.add(iso);
      out.push(iso);
      if (out.length > 3) {
        return { ok: false, error: 'Select maximum 3 available dates.' };
      }
    }
    if (!out.length) {
      return { ok: false, error: 'Select at least 1 available date.' };
    }
    return { ok: true, values: out };
  }

  async function promptTripAvailableDates(row) {
    const ctx = getTripDateContextFromFulfillment(row);
    if (!ctx.minIso || !ctx.maxIso) {
      showToast('Missing stay dates on this booking. Cannot set available trip dates.', 'error');
      return null;
    }

    const preferredInRange = isIsoWithinRange(ctx.preferredIso, ctx.minIso, ctx.maxIso);

    const supportsDialog = typeof window.HTMLDialogElement !== 'undefined';
    const probeDialog = supportsDialog ? document.createElement('dialog') : null;
    const canShowModal = Boolean(probeDialog && typeof probeDialog.showModal === 'function');

    const details = detailsObjectFromFulfillment(row) || {};
    const previousRaw = Array.isArray(details?.partner_proposed_dates)
      ? details.partner_proposed_dates
      : (Array.isArray(details?.proposed_dates) ? details.proposed_dates : []);
    const previousParsed = normalizeTripProposedDateList(previousRaw, ctx.minIso, ctx.maxIso);
    const previousValues = previousParsed.ok && previousParsed.values.length
      ? previousParsed.values.slice(0, 3)
      : [];
    const defaultPromptValue = previousValues.join(', ');

    if (!canShowModal) {
      const preferredLabel = preferredInRange ? `Preferred: ${ctx.preferredIso}. ` : '';
      const input = prompt(
        `${preferredLabel}Enter 1-3 available dates between ${ctx.minIso} and ${ctx.maxIso}, separated by commas:`,
        defaultPromptValue
      );
      if (input == null) return null;
      const parsed = normalizeTripProposedDateList(String(input || '').split(','), ctx.minIso, ctx.maxIso);
      if (!parsed.ok) {
        showToast(parsed.error, 'error');
        return null;
      }
      return parsed.values;
    }

    const initialSelected = previousParsed.ok && previousParsed.values.length
      ? previousParsed.values.slice(0, 3)
      : [];

    const buildMonthList = (minIso, maxIso, maxCount = 18) => {
      const min = String(minIso || '').trim();
      const max = String(maxIso || '').trim();
      const minMatch = min.match(/^(\d{4})-(\d{2})-\d{2}$/);
      const maxMatch = max.match(/^(\d{4})-(\d{2})-\d{2}$/);
      if (!minMatch || !maxMatch) return [];
      let year = Number(minMatch[1]);
      let month = Number(minMatch[2]);
      const endYear = Number(maxMatch[1]);
      const endMonth = Number(maxMatch[2]);
      const list = [];
      let guard = 0;
      while (guard < maxCount && (year < endYear || (year === endYear && month <= endMonth))) {
        list.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        guard += 1;
      }
      return list;
    };

    const monthValues = buildMonthList(ctx.minIso, ctx.maxIso);
    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    return await new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.style.padding = '0';
      dialog.style.border = '1px solid rgba(148,163,184,0.35)';
      dialog.style.borderRadius = '14px';
      dialog.style.background = 'linear-gradient(180deg,#0f172a 0%,#111f3b 100%)';
      dialog.style.color = '#e5e7eb';
      dialog.style.maxWidth = '520px';
      dialog.style.width = 'min(94vw, 760px)';
      dialog.style.boxShadow = '0 24px 64px rgba(2,6,23,0.65)';

      const preferredNote = preferredInRange
        ? `<div style="font-size:12px; margin-top:4px; color:#facc15;"><strong>Preferred date:</strong> ${escapeHtml(formatDateDmy(ctx.preferredIso))} (highlighted in yellow)</div>`
        : '<div style="font-size:12px; margin-top:4px; color:#94a3b8;">Preferred date is outside stay window or missing.</div>';

      dialog.innerHTML = `
        <style>
          .trip-date-modal-title { font-size: 18px; font-weight: 800; letter-spacing: 0.01em; }
          .trip-date-legend { display:flex; flex-wrap:wrap; gap:8px; margin-top:2px; font-size:11px; color:#cbd5e1; }
          .trip-date-legend-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; border:1px solid rgba(148,163,184,0.4); background:rgba(15,23,42,0.5); }
          .trip-date-dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
          .trip-date-dot--range { background:#3b82f6; }
          .trip-date-dot--preferred { background:#facc15; }
          .trip-date-dot--selected { background:#22c55e; }
          .trip-date-months { display:grid; gap:10px; max-height:min(62vh,560px); overflow:auto; padding-right:3px; }
          .trip-date-month-card { border:1px solid rgba(148,163,184,0.28); border-radius:12px; background:rgba(10,19,42,0.58); padding:10px; }
          .trip-date-month-header { font-size:12px; color:#dbeafe; font-weight:700; margin-bottom:8px; }
          .trip-date-weekdays, .trip-date-days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:6px; }
          .trip-date-weekdays div { text-align:center; font-size:10px; color:#93c5fd; text-transform:uppercase; letter-spacing:0.04em; font-weight:700; }
          .trip-date-day {
            height:34px; border-radius:9px; border:1px solid rgba(148,163,184,0.34);
            background:rgba(15,23,42,0.62); color:#e2e8f0; font-weight:700; cursor:pointer;
            display:flex; align-items:center; justify-content:center; transition:all .15s ease;
          }
          .trip-date-day:hover { transform:translateY(-1px); border-color:rgba(96,165,250,0.7); }
          .trip-date-day--blank { height:34px; }
          .trip-date-day--disabled {
            background:rgba(15,23,42,0.25); color:rgba(148,163,184,0.55); border-color:rgba(148,163,184,0.18); cursor:not-allowed;
          }
          .trip-date-day--preferred { border-color:rgba(250,204,21,0.9); box-shadow:inset 0 0 0 1px rgba(250,204,21,0.52); }
          .trip-date-day--selected { background:rgba(34,197,94,0.22); border-color:rgba(34,197,94,0.85); color:#dcfce7; }
          .trip-date-day--selected.trip-date-day--preferred {
            background:linear-gradient(180deg,rgba(250,204,21,0.28),rgba(34,197,94,0.22));
            border-color:rgba(250,204,21,0.95);
            color:#fef9c3;
          }
          .trip-date-selected { border:1px dashed rgba(148,163,184,0.35); border-radius:11px; padding:9px; background:rgba(15,23,42,0.35); }
          .trip-date-selected-label { font-size:11px; color:#bfdbfe; margin-bottom:7px; font-weight:700; letter-spacing:0.02em; text-transform:uppercase; }
          .trip-date-selected-list { display:flex; flex-wrap:wrap; gap:6px; }
          .trip-date-selected-pill {
            display:inline-flex; align-items:center; gap:6px; border-radius:999px;
            border:1px solid rgba(59,130,246,0.58); background:rgba(30,64,175,0.34); color:#dbeafe;
            padding:5px 9px; font-size:12px; font-weight:700;
          }
          .trip-date-selected-empty { font-size:12px; color:#94a3b8; }
          @media (max-width: 640px) {
            .trip-date-months { max-height:min(58vh,460px); }
            .trip-date-day { height:32px; font-size:12px; }
          }
        </style>
        <form method="dialog" style="padding:16px 16px 14px; display:grid; gap:10px;">
          <div class="trip-date-modal-title">Select available trip dates</div>
          <div style="font-size:12px; color:#cbd5e1;">Customer stay window: <strong>${escapeHtml(formatDateDmy(ctx.minIso))}</strong> → <strong>${escapeHtml(formatDateDmy(ctx.maxIso))}</strong></div>
          <div style="font-size:12px; color:#93c5fd;">Click a day to select, click again to unselect. Choose up to 3 dates.</div>
          ${preferredNote}
          <div class="trip-date-legend">
            <span class="trip-date-legend-chip"><span class="trip-date-dot trip-date-dot--range"></span>Selectable range</span>
            <span class="trip-date-legend-chip"><span class="trip-date-dot trip-date-dot--preferred"></span>Preferred date</span>
            <span class="trip-date-legend-chip"><span class="trip-date-dot trip-date-dot--selected"></span>Selected by partner (max 3)</span>
          </div>
          <div class="trip-date-months" data-trip-date-months></div>
          <div class="trip-date-selected">
            <div class="trip-date-selected-label">Selected available dates</div>
            <div class="trip-date-selected-list" data-trip-date-selected></div>
          </div>
          <div data-trip-date-error style="min-height:18px; font-size:12px; color:#fca5a5;"></div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2px;">
            <button type="button" data-trip-date-cancel style="height:36px; padding:0 12px; border-radius:9px; border:1px solid rgba(148,163,184,0.45); background:transparent; color:#e2e8f0; font-weight:700; cursor:pointer;">Cancel</button>
            <button type="submit" data-trip-date-submit style="height:36px; padding:0 14px; border-radius:9px; border:0; background:#ef4444; color:white; font-weight:800; cursor:pointer;">Save & send options</button>
          </div>
        </form>
      `;

      const cleanup = () => {
        try { dialog.close(); } catch (_e) {}
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
      };

      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(value);
      };

      const form = dialog.querySelector('form');
      const errorEl = dialog.querySelector('[data-trip-date-error]');
      const cancelBtn = dialog.querySelector('[data-trip-date-cancel]');
      const submitBtn = dialog.querySelector('[data-trip-date-submit]');
      const monthsWrap = dialog.querySelector('[data-trip-date-months]');
      const selectedWrap = dialog.querySelector('[data-trip-date-selected]');
      const selectedSet = new Set(initialSelected.map((raw) => normalizeIsoDateValue(raw)).filter(Boolean));

      const formatMonthLabel = (monthValue) => {
        const match = String(monthValue || '').trim().match(/^(\d{4})-(\d{2})$/);
        if (!match) return monthValue;
        const year = Number(match[1]);
        const month = Number(match[2]);
        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return monthValue;
        return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
      };

      const sortedSelected = () => Array.from(selectedSet).sort();

      const setError = (msg) => {
        if (errorEl) errorEl.textContent = String(msg || '').trim();
      };

      const clearError = () => setError('');

      const renderSelected = () => {
        if (!selectedWrap) return;
        const dates = sortedSelected();
        if (!dates.length) {
          selectedWrap.innerHTML = '<span class="trip-date-selected-empty">Select at least 1 date.</span>';
          return;
        }
        selectedWrap.innerHTML = dates
          .map((iso) => `<span class="trip-date-selected-pill">${escapeHtml(formatDateDmy(iso))}</span>`)
          .join('');
      };

      const renderMonths = () => {
        if (!monthsWrap) return;
        let html = '';
        const rangeStart = ctx.minIso;
        const rangeEnd = ctx.maxIso;

        for (const monthValue of monthValues) {
          const match = String(monthValue || '').trim().match(/^(\d{4})-(\d{2})$/);
          if (!match) continue;
          const year = Number(match[1]);
          const month = Number(match[2]);
          if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue;

          const firstDay = new Date(Date.UTC(year, month - 1, 1));
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const weekdayOffset = (firstDay.getUTCDay() + 6) % 7;

          let daysHtml = '';
          for (let blank = 0; blank < weekdayOffset; blank += 1) {
            daysHtml += '<div class="trip-date-day--blank" aria-hidden="true"></div>';
          }

          for (let day = 1; day <= daysInMonth; day += 1) {
            const iso = `${monthValue}-${String(day).padStart(2, '0')}`;
            const inRange = iso >= rangeStart && iso <= rangeEnd;
            const isPreferred = Boolean(ctx.preferredIso && iso === ctx.preferredIso);
            const isSelected = selectedSet.has(iso);
            const classNames = [
              'trip-date-day',
              inRange ? '' : 'trip-date-day--disabled',
              isPreferred ? 'trip-date-day--preferred' : '',
              isSelected ? 'trip-date-day--selected' : '',
            ].filter(Boolean).join(' ');
            const title = inRange
              ? `${formatDateDmy(iso)}${isPreferred ? ' · preferred date' : ''}`
              : `${formatDateDmy(iso)} · outside customer stay range`;
            const disabledAttr = inRange ? '' : 'disabled';
            daysHtml += `
              <button
                type="button"
                class="${classNames}"
                data-trip-date-iso="${escapeHtml(iso)}"
                title="${escapeHtml(title)}"
                ${disabledAttr}
              >${day}</button>
            `;
          }

          const weekdaysHtml = weekdayLabels.map((label) => `<div>${escapeHtml(label)}</div>`).join('');
          html += `
            <section class="trip-date-month-card">
              <div class="trip-date-month-header">${escapeHtml(formatMonthLabel(monthValue))}</div>
              <div class="trip-date-weekdays">${weekdaysHtml}</div>
              <div class="trip-date-days">${daysHtml}</div>
            </section>
          `;
        }

        monthsWrap.innerHTML = html || '<div style="color:#94a3b8; font-size:12px;">No calendar dates available for this stay range.</div>';
      };

      const updateSubmitState = () => {
        if (!submitBtn) return;
        submitBtn.disabled = selectedSet.size < 1;
        submitBtn.style.opacity = submitBtn.disabled ? '0.65' : '1';
        submitBtn.style.cursor = submitBtn.disabled ? 'not-allowed' : 'pointer';
      };

      const rerender = () => {
        renderMonths();
        renderSelected();
        updateSubmitState();
      };

      const submitHandler = (event) => {
        event.preventDefault();
        const values = sortedSelected();
        const parsed = normalizeTripProposedDateList(values, ctx.minIso, ctx.maxIso);
        if (!parsed.ok) {
          setError(parsed.error);
          return;
        }
        finish(parsed.values);
      };

      monthsWrap?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('button[data-trip-date-iso]') : null;
        if (!target) return;
        const iso = normalizeIsoDateValue(target.getAttribute('data-trip-date-iso') || '');
        if (!iso || !isIsoWithinRange(iso, ctx.minIso, ctx.maxIso)) return;

        clearError();
        if (selectedSet.has(iso)) {
          selectedSet.delete(iso);
          rerender();
          return;
        }
        if (selectedSet.size >= 3) {
          setError('You can select maximum 3 available dates.');
          return;
        }
        selectedSet.add(iso);
        rerender();
      });

      form?.addEventListener('submit', submitHandler);
      cancelBtn?.addEventListener('click', () => finish(null));
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(null);
      });
      dialog.addEventListener('close', () => {
        if (!done) finish(null);
      });

      document.body.appendChild(dialog);
      rerender();
      try {
        dialog.showModal();
      } catch (_e) {
        finish(null);
      }
    });
  }

  function messageForFulfillmentAction(action, result) {
    const act = String(action || '').trim();
    const ok = Boolean(result && typeof result === 'object' && result.ok !== false);
    const skipped = Boolean(result && typeof result === 'object' && result.skipped);
    const reason = result && typeof result === 'object' ? String(result.reason || '').trim() : '';
    const nextStatus = result && typeof result === 'object' && result.data && typeof result.data === 'object'
      ? String(result.data.status || '').trim()
      : '';
    const tripDateSelectionRequired = Boolean(
      result
      && typeof result === 'object'
      && result.data
      && typeof result.data === 'object'
      && result.data.trip_date_selection_required
    );

    if (!ok) {
      return act === 'reject' ? 'Failed to reject fulfillment' : 'Failed to accept fulfillment';
    }

    if (skipped) {
      if (reason === 'already_claimed') return 'This order was already accepted by another partner.';
      if (reason === 'already_accepted') return 'This fulfillment is already accepted.';
      if (reason === 'already_rejected') return 'This fulfillment is already rejected.';
      if (reason === 'status_changed') return 'This fulfillment status changed. Please refresh.';
      return 'No changes were applied.';
    }

    if (act === 'reject') return 'Fulfillment rejected';

    if (tripDateSelectionRequired) {
      return 'Accepted. Date options saved.';
    }

    if (nextStatus === 'awaiting_payment') {
      return 'Accepted. Awaiting deposit payment.';
    }
    return 'Fulfillment accepted';
  }

  function getFulfillmentFocusIdFromHash() {
    const raw = String(window.location?.hash || '');
    if (!raw) return null;
    const h = raw.startsWith('#') ? raw.slice(1) : raw;
    const prefix = 'fulfillments:';
    if (!h.toLowerCase().startsWith(prefix)) return null;
    const rest = h.slice(prefix.length);
    const decoded = (() => {
      try {
        return decodeURIComponent(rest);
      } catch (_e) {
        return rest;
      }
    })();
    const id = String(decoded || '').trim();
    return id || null;
  }

  function clearFulfillmentHighlights() {
    if (!els.fulfillmentsBody) return;
    els.fulfillmentsBody.querySelectorAll('tr[data-fulfillment-id]').forEach((tr) => {
      tr.style.boxShadow = '';
      tr.style.background = '';
    });
  }

  function focusFulfillmentRowFromHash() {
    const fid = getFulfillmentFocusIdFromHash();
    if (!fid) return;
    if (!els.fulfillmentsBody) return;

    const rows = Array.from(els.fulfillmentsBody.querySelectorAll('tr[data-fulfillment-id]'));
    const row = rows.find((tr) => String(tr.getAttribute('data-fulfillment-id') || '') === String(fid));
    if (!row) return;

    clearFulfillmentHighlights();

    row.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.55)';
    row.style.background = 'rgba(37, 99, 235, 0.08)';

    try {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_e) {
      try {
        row.scrollIntoView(true);
      } catch (_e2) {}
    }

    setTimeout(() => {
      if (!row.isConnected) return;
      row.style.boxShadow = '';
      row.style.background = '';
    }, 6000);
  }

  function renderFulfillmentsTable(filteredInput) {
    if (!els.fulfillmentsBody) return;

    const filtered = Array.isArray(filteredInput) ? filteredInput : filteredFulfillmentsForOrdersPanel();

    if (!filtered.length) {
      const baseRows = filteredFulfillmentsForSelectedCategory();
      const noMatchByFilters = baseRows.length > 0;
      const dbg = state.lastFulfillmentsDebug;
      const dbgHtml = dbg
        ? `<div class="small muted" style="margin-top: 6px;">Debug: shop ${Number(dbg.raw_shop || 0)}, service ${Number(dbg.raw_service || 0)}, closed ${Number(dbg.closed || 0)}, after_filters ${Number(dbg.filtered_total || 0)}</div>`
        : '';
      const msg = noMatchByFilters
        ? 'No fulfillments match the current filters.'
        : 'No fulfillments found.';
      setHtml(els.fulfillmentsBody, `<tr><td colspan="6" class="muted" style="padding: 16px 8px;">${msg}${dbgHtml}</td></tr>`);
      return;
    }

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const isSuspended = partner && partner.status === 'suspended';

    const isEmptyFormValue = (v) => {
      if (v == null) return true;
      if (typeof v === 'string') return !String(v).trim();
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === 'object') return Object.keys(v).length === 0;
      return false;
    };

    const labelForFormKey = (k) => {
      const raw = String(k || '').trim();
      if (!raw) return '';
      return raw
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^./, (c) => c.toUpperCase());
    };

    const renderFormValue = (v) => {
      if (v == null) return '<span class="muted">—</span>';

      if (typeof v === 'boolean') {
        return escapeHtml(v ? 'Yes' : 'No');
      }

      if (typeof v === 'number') {
        return escapeHtml(String(v));
      }

      if (typeof v === 'string') {
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          return escapeHtml(formatDateDmy(s));
        }
        return escapeHtml(s);
      }

      if (Array.isArray(v)) {
        const parts = v.filter((x) => !isEmptyFormValue(x)).map((x) => {
          if (x == null) return '';
          if (typeof x === 'string') return x;
          if (typeof x === 'number' || typeof x === 'boolean') return String(x);
          try {
            return JSON.stringify(x);
          } catch (_e) {
            return String(x);
          }
        }).filter(Boolean);
        return escapeHtml(parts.join(', '));
      }

      if (typeof v === 'object') {
        const addressLike = (v && typeof v === 'object') && ('line1' in v || 'postal_code' in v || 'city' in v || 'country' in v);
        if (addressLike) {
          const parts = [v.line1, v.line2, v.postal_code, v.city, v.country].filter(Boolean).map((x) => String(x));
          return escapeHtml(parts.join(', '));
        }

        let pretty = '';
        try {
          pretty = JSON.stringify(v, null, 2);
        } catch (_e) {
          pretty = String(v);
        }
        return `<pre class="small muted" style="white-space:pre-wrap; margin:4px 0 0;">${escapeHtml(pretty)}</pre>`;
      }

      return escapeHtml(String(v));
    };

    const valueTextForModal = (v) => {
      if (v == null) return '';
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      if (typeof v === 'number') return String(v);
      if (typeof v === 'string') return String(v);
      if (Array.isArray(v)) {
        return v.filter((x) => !isEmptyFormValue(x)).map((x) => {
          if (x == null) return '';
          if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return String(x);
          try {
            return JSON.stringify(x);
          } catch (_e) {
            return String(x);
          }
        }).filter(Boolean).join(', ');
      }
      try {
        return JSON.stringify(v, null, 2);
      } catch (_e) {
        return String(v);
      }
    };

    const normalizeFormKey = (k) => String(k || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const SENSITIVE_FORM_KEYS = new Set([
      'name',
      'firstname',
      'lastname',
      'surname',
      'fullname',
      'customername',
      'email',
      'customeremail',
      'phone',
      'customerphone',
      'phonenumber',
      'telephone',
      'mobile',
      'whatsapp',
      'telegram',
    ]);

    const isSensitiveFormKey = (k) => {
      const nk = normalizeFormKey(k);
      if (!nk) return false;
      if (nk.startsWith('contact')) return true;
      return SENSITIVE_FORM_KEYS.has(nk);
    };

    const parseDateTimeForCarDuration = (dateRaw, timeRaw, fallbackTime = '10:00') => {
      const dateText = String(dateRaw || '').trim();
      if (!dateText) return null;

      const isoDateMatch = dateText.match(/^(\d{4}-\d{2}-\d{2})/);
      const datePart = isoDateMatch ? isoDateMatch[1] : '';

      const timeText = String(timeRaw || '').trim();
      const hhmmMatch = timeText.match(/^([01]\d|2[0-3]):([0-5]\d)/);
      const timePart = hhmmMatch ? `${hhmmMatch[1]}:${hhmmMatch[2]}` : fallbackTime;

      const isoSource = datePart ? `${datePart}T${timePart}` : dateText;
      const dt = new Date(isoSource);
      if (Number.isNaN(dt.getTime())) return null;
      return dt;
    };

    const calculateCarDurationDays = (fulfillment, snapshotPayload) => {
      if (!fulfillment) return null;
      if (String(fulfillment.resource_type || '') !== 'cars') return null;

      const details = (fulfillment.details && typeof fulfillment.details === 'object') ? fulfillment.details : null;
      const payload = (snapshotPayload && typeof snapshotPayload === 'object') ? snapshotPayload : null;

      const pickupDateRaw = payload?.pickup_date ?? details?.pickup_date ?? details?.pickupDate ?? fulfillment.start_date ?? null;
      const returnDateRaw = payload?.return_date ?? details?.return_date ?? details?.returnDate ?? fulfillment.end_date ?? null;
      const pickupTimeRaw = payload?.pickup_time ?? details?.pickup_time ?? details?.pickupTime ?? null;
      const returnTimeRaw = payload?.return_time ?? details?.return_time ?? details?.returnTime ?? null;

      const pickupAt = parseDateTimeForCarDuration(pickupDateRaw, pickupTimeRaw);
      const returnAt = parseDateTimeForCarDuration(returnDateRaw, returnTimeRaw);

      if (pickupAt && returnAt) {
        const hours = (returnAt.getTime() - pickupAt.getTime()) / 36e5;
        if (Number.isFinite(hours) && hours > 0) {
          const days = Math.ceil(hours / 24);
          if (Number.isFinite(days) && days > 0) return Math.max(days, 3);
        }
      }

      const explicitDuration = payload?.duration_days
        ?? payload?.durationDays
        ?? payload?.duration
        ?? details?.duration_days
        ?? details?.durationDays
        ?? details?.duration;
      const dn = explicitDuration != null ? Number(explicitDuration) : null;
      if (dn != null && Number.isFinite(dn) && dn > 0) return Math.max(Math.ceil(dn), 3);

      return null;
    };

    const sectionHtml = (title, pairs) => {
      const rows = (pairs || [])
        .filter((p) => p && String(p.label || '').trim() && !isEmptyFormValue(p.value))
        .map((p) => {
          const label = escapeHtml(String(p.label || ''));
          const value = p.value;
          const rawText = valueTextForModal(value);
          const valueClassRaw = String(p.valueClass || '').trim();
          const valueClass = valueClassRaw ? valueClassRaw.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() : '';
          const valueClassAttr = valueClass ? ` ${valueClass}` : '';

          let valueHtml = '';
          if (p.kind === 'email') {
            const s = String(value || '').trim();
            valueHtml = s ? `<a href="mailto:${encodeURIComponent(s)}">${escapeHtml(s)}</a>` : '<span class="muted">—</span>';
          } else if (p.kind === 'tel') {
            const s = String(value || '').trim();
            valueHtml = s ? `<a href="tel:${encodeURIComponent(s)}">${escapeHtml(s)}</a>` : '<span class="muted">—</span>';
          } else if (p.kind === 'link') {
            const s = String(value || '').trim();
            valueHtml = s ? `<a href="${escapeHtml(s)}" target="_blank" rel="noopener">${escapeHtml(s)}</a>` : '<span class="muted">—</span>';
          } else if (p.kind === 'pre') {
            valueHtml = rawText ? `<pre>${escapeHtml(rawText)}</pre>` : '<span class="muted">—</span>';
          } else {
            valueHtml = renderFormValue(value);
          }

          return `
            <div class="partner-details-kv-row">
              <div class="partner-details-label">${label}</div>
              <div class="partner-details-value${valueClassAttr}">${valueHtml}</div>
            </div>
          `;
        })
        .join('');

      if (!rows) return '';
      return `
        <div class="partner-details-section">
          <h3 class="partner-details-section__title">${escapeHtml(title)}</h3>
          <div class="partner-details-kv">${rows}</div>
        </div>
      `;
    };

    const renderPartnerDetailsIntoModal = (fulfillment) => {
      if (!fulfillment) return;

      const f = fulfillment;
      const id = String(f.id || '');
      const isShop = String(f.__source || '') === 'shop';
      const category = isShop ? 'shop' : String(f.resource_type || 'service');

      const contact = state.contactsByFulfillmentId[id] || null;
      const snapshotPayload = (state.formSnapshotsByFulfillmentId[id]?.payload && typeof state.formSnapshotsByFulfillmentId[id].payload === 'object')
        ? state.formSnapshotsByFulfillmentId[id].payload
        : null;
      const detailsPayload = detailsObjectFromFulfillment(f) || null;
      const transportBooking = category === 'transport'
        ? (state.transportBookingsById[String(f.booking_id || '').trim()] || null)
        : null;
      const transportRouteContext = category === 'transport' && f.__transportRouteContext && typeof f.__transportRouteContext === 'object'
        ? f.__transportRouteContext
        : null;
      const isContactRevealed = Boolean(f.contact_revealed_at);

      const title = isShop ? 'Shop order details' : 'Booking details';
      if (els.partnerDetailsTitle) els.partnerDetailsTitle.textContent = title;

      const orderRef = (() => {
        if (isShop) return f.order_number || (f.order_id ? String(f.order_id).slice(0, 8) : String(id).slice(0, 8));
        return f.reference || (f.booking_id ? String(f.booking_id).slice(0, 8) : String(id).slice(0, 8));
      })();
      const metaParts = [orderRef ? `Ref: ${orderRef}` : '', f.created_at ? `Created: ${formatDate(f.created_at)}` : '', f.summary ? String(f.summary) : '']
        .map((x) => String(x || '').trim())
        .filter(Boolean);
      if (els.partnerDetailsMeta) els.partnerDetailsMeta.textContent = metaParts.join(' · ');

      if (els.partnerDetailsStatus) {
        const categoryPill = category ? String(category).toUpperCase() : '';
        const orderStatus = (!isShop && category !== 'service')
          ? resolveServiceOrderStatus(f)
          : String(f.status || '').trim().toLowerCase();
        const statusPill = orderStatus ? String(orderStatus).replace(/_/g, ' ').toUpperCase() : '';
        const pill = [categoryPill, statusPill].filter(Boolean).join(' · ');
        els.partnerDetailsStatus.hidden = !pill;
        els.partnerDetailsStatus.textContent = pill;
      }

      const usedKeys = new Set();
      const getPayload = (key) => {
        if (!snapshotPayload) return null;
        const v = snapshotPayload[key];
        if (v === undefined) return null;
        usedKeys.add(key);
        return v;
      };
      const markKeysUsed = (...keys) => {
        keys.forEach((key) => {
          keyVariants(key).forEach((variant) => usedKeys.add(variant));
        });
      };
      const keyVariants = (key) => {
        const k = String(key || '').trim();
        if (!k) return [];
        const out = new Set([k]);
        if (k.includes('_')) {
          const camel = k.replace(/_([a-z0-9])/g, (_m, c) => String(c || '').toUpperCase());
          if (camel) out.add(camel);
        } else if (/[A-Z]/.test(k)) {
          const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase();
          if (snake) out.add(snake);
        }
        return Array.from(out);
      };
      const getField = (...keys) => {
        for (const key of keys) {
          const variants = keyVariants(key);
          for (const variant of variants) {
            const payloadValue = getPayload(variant);
            if (payloadValue !== null) return payloadValue;
          }
          for (const variant of variants) {
            if (!detailsPayload) break;
            const detailsValue = detailsPayload[variant];
            if (detailsValue !== undefined && detailsValue !== null) {
              if (typeof detailsValue === 'string' && !detailsValue.trim()) continue;
              usedKeys.add(variant);
              return detailsValue;
            }
          }
          for (const variant of variants) {
            if (!transportBooking) break;
            const bookingValue = transportBooking[variant];
            if (bookingValue === undefined || bookingValue === null) continue;
            if (typeof bookingValue === 'string' && !bookingValue.trim()) continue;
            usedKeys.add(variant);
            return bookingValue;
          }
        }

        if (keys.some((k) => String(k) === 'pickup_date') && f.start_date) {
          usedKeys.add('pickup_date');
          return f.start_date;
        }
        if (keys.some((k) => String(k) === 'return_date') && f.end_date) {
          usedKeys.add('return_date');
          return f.end_date;
        }
        if (keys.some((k) => String(k) === 'car_model') && f.summary) {
          usedKeys.add('car_model');
          return f.summary;
        }
        return null;
      };
      const formatLocationLabel = (value) => {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return value;
        return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      };
      const formatDateLabel = (value) => {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return formatDateDmy(raw);
        return raw;
      };
      const formatTimeLabel = (value) => {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        const m = raw.match(/^([01]\d|2[0-3]):([0-5]\d)/);
        return m ? `${m[1]}:${m[2]}` : raw;
      };
      const hotelBooking = category === 'hotels'
        ? (state.hotelBookingsById[String(f.booking_id || '').trim()] || null)
        : null;
      const hotelResourceId = String(hotelBooking?.hotel_id || f.resource_id || '').trim();
      const hotelResource = category === 'hotels'
        ? (state.hotelResourcesById[hotelResourceId] || null)
        : null;
      const hotelBreakdown = category === 'hotels' && hotelBooking?.pricing_breakdown && typeof hotelBooking.pricing_breakdown === 'object'
        ? hotelBooking.pricing_breakdown
        : (detailsPayload?.pricing_breakdown && typeof detailsPayload.pricing_breakdown === 'object'
          ? detailsPayload.pricing_breakdown
          : {});
      const hotelBookingDetails = category === 'hotels' && hotelBooking?.booking_details && typeof hotelBooking.booking_details === 'object'
        ? hotelBooking.booking_details
        : (detailsPayload?.booking_details && typeof detailsPayload.booking_details === 'object'
          ? detailsPayload.booking_details
          : {});
      const hotelDecisionSupport = category === 'hotels'
        ? (state.hotelDecisionSupportByBookingId[String(hotelBooking?.id || '').trim()] || null)
        : null;
      const hotelRoomTypes = Array.isArray(hotelResource?.room_types) ? hotelResource.room_types : [];
      const hotelRoomTypeId = String(
        hotelBooking?.room_type_id
        || hotelBookingDetails?.room_type_id
        || getField('room_type_id')
        || ''
      ).trim();
      const hotelRoomType = hotelRoomTypeId
        ? (hotelRoomTypes.find((entry) => String(entry?.id || '').trim() === hotelRoomTypeId) || null)
        : null;
      const hotelRatePlanId = String(
        hotelBooking?.rate_plan_id
        || hotelBookingDetails?.rate_plan_id
        || getField('rate_plan_id')
        || ''
      ).trim();
      const hotelRatePlan = hotelRatePlanId && Array.isArray(hotelRoomType?.rate_plans)
        ? (hotelRoomType.rate_plans.find((entry) => String(entry?.id || '').trim() === hotelRatePlanId) || null)
        : null;
      const hotelLocation = (() => {
        const resourceLocation = hotelResource && typeof hotelResource === 'object'
          ? {
            address_line: hotelResource.address_line,
            district: hotelResource.district,
            postal_code: hotelResource.postal_code,
            city: hotelResource.city,
            country: hotelResource.country,
            latitude: hotelResource.latitude,
            longitude: hotelResource.longitude,
            google_maps_url: hotelResource.google_maps_url,
            google_place_id: hotelResource.google_place_id,
          }
          : {};
        const bookingLocation = hotelBookingDetails?.hotel_location && typeof hotelBookingDetails.hotel_location === 'object'
          ? hotelBookingDetails.hotel_location
          : {};
        return { ...resourceLocation, ...bookingLocation };
      })();
      const hotelLocationSummary = (() => {
        const summary = String(hotelLocation.summary || '').trim();
        if (summary) return summary;
        return [
          hotelLocation.address_line,
          hotelLocation.district,
          hotelLocation.postal_code,
          hotelLocation.city,
          hotelLocation.country,
        ].map((value) => String(value || '').trim()).filter(Boolean).join(', ');
      })();
      const hotelMapsUrl = buildGoogleMapsHref({
        ...hotelLocation,
        hotel_maps_url: hotelBookingDetails?.hotel_maps_url,
      });
      const hotelRoomGalleryUrls = (() => {
        const values = [
          ...(Array.isArray(hotelBookingDetails?.room_gallery_photos) ? hotelBookingDetails.room_gallery_photos : []),
          ...(Array.isArray(hotelRoomType?.gallery_photos) ? hotelRoomType.gallery_photos : []),
          ...(Array.isArray(hotelRoomType?.photos) ? hotelRoomType.photos : []),
          hotelBookingDetails?.room_cover_image_url,
          hotelRoomType?.cover_image_url,
          hotelResource?.cover_image_url,
          ...(Array.isArray(hotelResource?.photos) ? hotelResource.photos : []),
        ];
        return Array.from(new Set(values.map((entry) => String(entry || '').trim()).filter(Boolean)));
      })();
      const hotelCurrency = String(hotelBooking?.currency || f.currency || 'EUR').trim().toUpperCase() || 'EUR';
      const hotelRoomTypeName = localizedLabelFromValue(
        hotelBooking?.room_type_name
        || hotelBookingDetails?.room_type_name
        || hotelRoomType?.name,
        'en',
      ) || null;
      const hotelRatePlanName = localizedLabelFromValue(
        hotelBooking?.rate_plan_name
        || hotelBookingDetails?.rate_plan_name
        || hotelRatePlan?.name,
        'en',
      ) || null;

      const servicePaymentSummary = (() => {
        if (isShop) return null;

        const currency = String(f.currency || 'EUR').trim().toUpperCase() || 'EUR';
        const totalRaw = category === 'cars'
          ? Number(getCarsFulfillmentPricing(f).amount)
          : Number(
            category === 'hotels'
              ? (hotelBooking?.total_price ?? f.total_price)
              : (category === 'transport' ? (transportBooking?.total_price ?? f.total_price) : f.total_price)
          );
        if (!Number.isFinite(totalRaw) || totalRaw <= 0) return null;

        const paidDepositFromState = toNum(state.serviceDepositByFulfillmentId[String(id || '').trim()] || 0);
        const paidDepositFromDetails = toNum(
          getField('deposit_amount', 'deposit_paid_amount', 'deposit_to_pay')
          || detailsPayload?.deposit_amount
          || detailsPayload?.deposit_paid_amount
          || detailsPayload?.depositToPay
          || 0
        );
        const paidDeposit = Math.max(0, paidDepositFromState > 0 ? paidDepositFromState : paidDepositFromDetails);
        const remaining = Math.max(0, Number((totalRaw - paidDeposit).toFixed(2)));

        return {
          currency: category === 'transport'
            ? (String(transportBooking?.currency || currency).trim().toUpperCase() || 'EUR')
            : currency,
          total: Number(totalRaw.toFixed(2)),
          paidDeposit: Number(paidDeposit.toFixed(2)),
          remaining,
        };
      })();

      const paymentSummaryPairs = servicePaymentSummary
        ? [
          { label: 'Total price', value: formatMoney(servicePaymentSummary.total, servicePaymentSummary.currency) },
          { label: 'Paid deposit', value: formatMoney(servicePaymentSummary.paidDeposit, servicePaymentSummary.currency) },
          { label: 'Remaining to collect on-site', value: formatMoney(servicePaymentSummary.remaining, servicePaymentSummary.currency), valueClass: 'partner-details-value--highlight-green' },
        ]
        : [];

      const customerSectionPairs = (() => {
        const pairs = (() => {
          if (category === 'cars') {
            return [
              { label: 'Name', value: contact?.customer_name ?? getField('full_name', 'customer_name') ?? null, key: 'customer_name' },
              { label: 'Email', value: contact?.customer_email ?? getField('email', 'customer_email') ?? null, kind: 'email', key: 'customer_email' },
              { label: 'Phone', value: contact?.customer_phone ?? getField('phone', 'customer_phone') ?? null, kind: 'tel', key: 'customer_phone' },
              { label: 'Country', value: getField('country') },
              ...paymentSummaryPairs,
            ];
          }

          if (category === 'trips' || category === 'hotels' || category === 'transport') {
            const base = [
              { label: 'Name', value: contact?.customer_name ?? getField('customer_name', 'full_name') ?? null, key: 'customer_name' },
              { label: 'Email', value: contact?.customer_email ?? getField('customer_email', 'email') ?? null, kind: 'email', key: 'customer_email' },
              { label: 'Phone', value: contact?.customer_phone ?? getField('customer_phone', 'phone') ?? null, kind: 'tel', key: 'customer_phone' },
            ];

            if (category === 'trips') {
              const tripTitleEn = String(
                f.__tripTitleEn
                || getField('trip_title_en', 'trip_name_en')
                || ''
              ).trim();
              const tripTitlePl = String(
                f.__tripTitlePl
                || getField('trip_title_pl', 'trip_name_pl')
                || ''
              ).trim();
              const tripSlug = String(
                f.__tripSlug
                || getField('trip_slug')
                || ''
              ).trim();
              const tripNameLabel = (() => {
                if (tripTitleEn && tripTitlePl && tripTitleEn.toLowerCase() !== tripTitlePl.toLowerCase()) {
                  return `${tripTitleEn} / ${tripTitlePl}`;
                }
                return tripTitleEn || tripTitlePl || String(f.summary || '').trim() || tripSlug || null;
              })();

              const adultsRaw = Number(getField('num_adults') || 0);
              const childrenRaw = Number(getField('num_children') || 0);
              const adults = Number.isFinite(adultsRaw) ? Math.max(0, adultsRaw) : 0;
              const children = Number.isFinite(childrenRaw) ? Math.max(0, childrenRaw) : 0;
              const totalPeople = adults + children;
              const peopleLabel = (() => {
                if (!(totalPeople > 0)) return null;
                if (children > 0) return `${totalPeople} (${adults} adults + ${children} children)`;
                return `${totalPeople} (${adults} adults)`;
              })();

              const selectedDateIso = normalizeIsoDateValue(
                getField('selected_trip_date')
                || getField('trip_date_selection_date')
                || getField('trip_date')
                || ''
              );
              const selectedDateLabel = selectedDateIso ? formatDateDmy(selectedDateIso) : null;
              const pickupAddress = getField('pickup_address');

              return [
                ...base,
                { label: 'Trip name (EN / PL)', value: tripNameLabel },
                { label: 'People', value: peopleLabel },
                { label: 'Selected date', value: selectedDateLabel, valueClass: 'partner-details-value--highlight-yellow' },
                { label: 'Pickup address', value: pickupAddress },
                ...paymentSummaryPairs,
              ];
            }

            return [...base, ...paymentSummaryPairs];
          }

          return [
            { label: 'Name', value: contact?.customer_name ?? getField('customer_name', 'full_name') ?? null, key: 'customer_name' },
            { label: 'Email', value: contact?.customer_email ?? getField('customer_email', 'email') ?? null, kind: 'email', key: 'customer_email' },
            { label: 'Phone', value: contact?.customer_phone ?? getField('customer_phone', 'phone') ?? null, kind: 'tel', key: 'customer_phone' },
            ...paymentSummaryPairs,
          ];
        })();

        if (isContactRevealed) return pairs;
        return pairs.map((p) => {
          if (!p) return p;
          if (!isSensitiveFormKey(p.key || p.label || '')) return p;
          return { ...p, value: null };
        });
      })();

      const shippingSectionPairs = (() => {
        if (category !== 'shop') return [];
        return [
          { label: 'Shipping address', value: contact?.shipping_address ?? getField('shipping_address') ?? null, kind: 'pre' },
          { label: 'Shipping method', value: getField('shipping_method_name') },
          { label: 'Estimated delivery', value: getField('estimated_delivery_date') },
        ];
      })();

      const billingSectionPairs = (() => {
        if (category !== 'shop') return [];
        return [
          { label: 'Billing address', value: contact?.billing_address ?? getField('billing_address') ?? null, kind: 'pre' },
        ];
      })();

      const carsRentalPairs = (() => {
        if (category !== 'cars') return [];
        return [
          { label: 'Car model', value: getField('car_model') },
          { label: 'Rental days', value: calculateCarDurationDays(f, snapshotPayload) },
          { label: 'Passengers', value: getField('num_passengers') },
          { label: 'Child seats', value: getField('child_seats') },
          { label: 'Full insurance', value: getField('full_insurance') },
        ];
      })();

      const carsPickupPairs = (() => {
        if (category !== 'cars') return [];
        return [
          { label: 'Pickup date', value: getField('pickup_date') },
          { label: 'Pickup time', value: getField('pickup_time') },
          { label: 'Pickup location', value: formatLocationLabel(getField('pickup_location')) },
          { label: 'Pickup address', value: getField('pickup_address') },
          { label: 'Flight number', value: getField('flight_number') },
        ];
      })();

      const carsReturnPairs = (() => {
        if (category !== 'cars') return [];
        return [
          { label: 'Return date', value: getField('return_date') },
          { label: 'Return time', value: getField('return_time') },
          { label: 'Return location', value: formatLocationLabel(getField('return_location')) },
          { label: 'Return address', value: getField('return_address') },
        ];
      })();

      const hotelsStayPairs = (() => {
        if (category !== 'hotels') return [];
        const inventoryUnits = (() => {
          if (hotelDecisionSupport?.configuredUnits != null) return hotelDecisionSupport.configuredUnits;
          const fallback = toNum(hotelBookingDetails?.room_inventory_units || 0);
          return fallback > 0 ? fallback : null;
        })();
        const guestsLabel = (() => {
          const adults = Number(getField('num_adults') || hotelBooking?.num_adults || 0);
          const children = Number(getField('num_children') || hotelBooking?.num_children || 0);
          if (!Number.isFinite(adults) && !Number.isFinite(children)) return null;
          return `${Math.max(0, adults)} adult(s), ${Math.max(0, children)} child(ren)`;
        })();
        return [
          { label: 'Arrival date', value: getField('arrival_date') || hotelBooking?.arrival_date || f.start_date || null },
          { label: 'Departure date', value: getField('departure_date') || hotelBooking?.departure_date || f.end_date || null },
          { label: 'Nights', value: getField('nights') || hotelBooking?.nights || null },
          { label: 'Guests', value: guestsLabel },
          { label: 'Room type', value: hotelRoomTypeName },
          { label: 'Rate plan', value: hotelRatePlanName },
          { label: 'Configured units', value: inventoryUnits },
          { label: 'Check-in from', value: hotelBookingDetails?.check_in_from || null },
          { label: 'Check-out until', value: hotelBookingDetails?.check_out_until || null },
          { label: 'Cancellation', value: hotelBookingDetails?.cancellation_policy_text || null },
          { label: 'Deposit note', value: hotelBookingDetails?.deposit_note_text || null },
          { label: 'Hotel location', value: hotelLocationSummary || null },
          { label: 'Google Maps', value: hotelMapsUrl || null, kind: hotelMapsUrl ? 'link' : undefined },
        ];
      })();

      const tripsDetailsPairs = (() => {
        if (category !== 'trips') return [];
        const proposedRaw = getField('partner_proposed_dates', 'proposed_dates');
        const proposedDates = Array.isArray(proposedRaw)
          ? Array.from(new Set(
            proposedRaw
              .map((v) => normalizeIsoDateValue(v))
              .filter(Boolean)
          )).slice(0, 3)
          : [];
        const selectionStatusRaw = String(getField('trip_date_selection_status') || '').trim().toLowerCase();
        const selectionStatusLabel = (() => {
          if (selectionStatusRaw === 'options_proposed') return 'Options proposed by partner';
          if (selectionStatusRaw === 'options_sent_to_customer') return 'Options sent to customer';
          if (selectionStatusRaw === 'selected') return 'Customer selected date';
          if (selectionStatusRaw === 'not_required') return 'Date selection not required';
          return selectionStatusRaw ? selectionStatusRaw.replace(/_/g, ' ') : null;
        })();
        const dateOptionsSentAtRaw = getField('trip_date_options_sent_at', 'trip_date_selection_sent_at');
        const dateOptionsExpiresAtRaw = getField('trip_date_options_expires_at', 'trip_date_selection_expires_at');
        return [
          { label: 'Preferred date', value: getField('preferred_date', 'trip_date') },
          { label: 'Available options', value: proposedDates.length ? proposedDates.map((iso) => formatDateDmy(iso)).join(', ') : null },
          { label: 'Date selection status', value: selectionStatusLabel },
          { label: 'Date options sent', value: dateOptionsSentAtRaw ? formatDateTime(dateOptionsSentAtRaw) : null },
          { label: 'Selection link expires', value: dateOptionsExpiresAtRaw ? formatDateTime(dateOptionsExpiresAtRaw) : null },
          { label: 'Selected date', value: getField('selected_trip_date') || getField('trip_date_selection_date') || null, valueClass: 'partner-details-value--highlight-yellow' },
          { label: 'Arrival date', value: getField('arrival_date') },
          { label: 'Departure date', value: getField('departure_date') },
          { label: 'Adults', value: getField('num_adults') },
          { label: 'Children', value: getField('num_children') },
        ];
      })();

      const transportRouteSummary = category === 'transport'
        ? String(transportRouteContext?.combinedLabel || f.summary || getField('route_label', 'route_name') || '').trim()
        : '';
      const transportTripTypeRaw = category === 'transport'
        ? String(transportRouteContext?.tripType || getField('trip_type') || '').trim().toLowerCase()
        : '';
      const transportHasReturn = category === 'transport'
        ? Boolean(
          transportRouteContext?.hasReturn
          || transportTripTypeRaw === 'round_trip'
          || getField('return_route_id')
          || getField('return_travel_date')
          || getField('return_travel_time')
          || getField('return_pickup_address')
          || getField('return_dropoff_address')
          || getField('return_flight_number')
        )
        : false;
      const transportTripTypeLabel = (() => {
        if (category !== 'transport') return '';
        if (transportTripTypeRaw === 'round_trip') return 'Round trip (2 rides)';
        if (transportTripTypeRaw === 'one_way') return 'One way';
        return transportHasReturn ? 'Round trip (2 rides)' : 'One way';
      })();
      if (category === 'transport') {
        markKeysUsed(
          'route_id',
          'route_label',
          'route_name',
          'origin_location_id',
          'destination_location_id',
          'origin_location_name',
          'destination_location_name',
          'origin_name',
          'destination_name',
          'return_route_id',
          'return_origin_location_id',
          'return_destination_location_id',
          'return_origin_location_name',
          'return_destination_location_name',
          'return_origin_name',
          'return_destination_name'
        );
      }
      const transportOverviewHtml = (() => {
        if (category !== 'transport') return '';
        const outboundWhen = [
          formatDateLabel(getField('travel_date')),
          formatTimeLabel(getField('travel_time')),
        ].filter(Boolean).join(' · ') || '—';
        const returnWhen = [
          formatDateLabel(getField('return_travel_date')),
          formatTimeLabel(getField('return_travel_time')),
        ].filter(Boolean).join(' · ');
        const cards = [
          { label: 'Route', value: transportRouteSummary || 'Transport booking' },
          { label: 'Trip type', value: transportTripTypeLabel || (transportHasReturn ? 'Round trip (2 rides)' : 'One way') },
          { label: 'Outbound', value: outboundWhen },
        ];
        if (transportHasReturn) cards.push({ label: 'Return', value: returnWhen || 'Return leg configured' });
        return `
          <div class="partner-details-section">
            <h3 class="partner-details-section__title">Trip overview</h3>
            <div class="partner-details-overview-grid">
              ${cards.map((card) => `
                <div class="partner-details-overview-card">
                  <div class="partner-details-overview-label">${escapeHtml(card.label)}</div>
                  <div class="partner-details-overview-value">${escapeHtml(card.value)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      })();
      const transportTripPairs = (() => {
        if (category !== 'transport') return [];
        const outboundRouteLabel = String(
          transportRouteContext?.outboundLabel
          || transportRouteSummary
          || getField('route_label', 'route_name')
          || ''
        ).trim();
        const returnRouteLabel = String(
          transportRouteContext?.returnLabel
          || transportRouteContext?.outboundLabel
          || transportRouteSummary
          || ''
        ).trim();
        const pairs = [
          { label: 'Outbound route', value: outboundRouteLabel || null },
          { label: 'Outbound date', value: getField('travel_date') },
          { label: 'Outbound time', value: getField('travel_time') },
        ];
        if (transportHasReturn) {
          pairs.push(
            { label: 'Return route', value: returnRouteLabel || null },
            { label: 'Return date', value: getField('return_travel_date') },
            { label: 'Return time', value: getField('return_travel_time') },
          );
        }
        return pairs;
      })();
      const transportPassengersPairs = (() => {
        if (category !== 'transport') return [];
        return [
          { label: 'Passengers', value: getField('num_passengers') },
          { label: 'Bags', value: getField('num_bags') },
          { label: 'Oversize bags', value: getField('num_oversize_bags') },
          { label: 'Child seats', value: getField('child_seats') },
          { label: 'Booster seats', value: getField('booster_seats') },
          { label: 'Waiting minutes', value: getField('waiting_minutes') },
        ];
      })();
      const transportOutboundPairs = (() => {
        if (category !== 'transport') return [];
        return [
          { label: 'Pickup address', value: getField('pickup_address') },
          { label: 'Dropoff address', value: getField('dropoff_address') },
          { label: 'Flight number', value: getField('flight_number') },
        ];
      })();
      const transportReturnPairs = (() => {
        if (category !== 'transport' || !transportHasReturn) return [];
        return [
          { label: 'Pickup address', value: getField('return_pickup_address') },
          { label: 'Dropoff address', value: getField('return_dropoff_address') },
          { label: 'Flight number', value: getField('return_flight_number') },
        ];
      })();

      const hotelOverviewHtml = (() => {
        if (category !== 'hotels') return '';
        const arrival = normalizeIsoDateValue(getField('arrival_date') || hotelBooking?.arrival_date || '');
        const departure = normalizeIsoDateValue(getField('departure_date') || hotelBooking?.departure_date || '');
        const totalAmount = Number(hotelBooking?.total_price ?? f.total_price ?? hotelBreakdown.base_total ?? 0);
        const guests = `${Math.max(0, Number(getField('num_adults') || hotelBooking?.num_adults || 0))} adult(s) + ${Math.max(0, Number(getField('num_children') || hotelBooking?.num_children || 0))} child(ren)`;
        const cards = [
          { label: 'Hotel', value: String(f.summary || hotelResource?.slug || '').trim() || 'Hotel booking' },
          { label: 'Stay', value: arrival && departure ? `${formatDateDmy(arrival)} → ${formatDateDmy(departure)}` : '—' },
          { label: 'Guests', value: guests },
          { label: 'Quoted total', value: Number.isFinite(totalAmount) && totalAmount > 0 ? formatMoney(totalAmount, hotelCurrency) : '—' },
        ];
        return `
          <div class="partner-details-section">
            <h3 class="partner-details-section__title">Hotel request snapshot</h3>
            <div class="partner-details-overview-grid">
              ${cards.map((card) => `
                <div class="partner-details-overview-card">
                  <div class="partner-details-overview-label">${escapeHtml(card.label)}</div>
                  <div class="partner-details-overview-value">${escapeHtml(card.value)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      })();

      const hotelPricingHtml = (() => {
        if (category !== 'hotels') return '';
        const roomTotal = Number(hotelBreakdown.room_total ?? hotelBooking?.total_price ?? f.total_price ?? 0);
        const roomBaseTotal = Number(hotelBreakdown.room_base_total ?? roomTotal ?? 0);
        const ratePlanAdjustmentTotal = Number(hotelBreakdown.rate_plan_adjustment_total ?? 0);
        const extrasTotal = Number(hotelBreakdown.extras_total ?? hotelBooking?.extras_price ?? 0);
        const mandatoryFeesTotal = Number(hotelBreakdown.mandatory_fees_total ?? 0);
        const optionalExtrasTotal = Number(hotelBreakdown.optional_extras_total ?? Math.max(0, extrasTotal - mandatoryFeesTotal));
        const finalTotal = Number(hotelBooking?.total_price ?? f.total_price ?? hotelBreakdown.base_total ?? roomTotal + extrasTotal);
        const nightlyRates = Array.isArray(hotelBreakdown.nightly_rates) ? hotelBreakdown.nightly_rates : [];
        const appliedExtras = Array.isArray(hotelBreakdown.applied_extras) ? hotelBreakdown.applied_extras : [];
        const rows = [
          { label: 'Room total', value: formatMoney(roomTotal, hotelCurrency), emphasize: false },
          { label: 'Room base before plan', value: formatMoney(roomBaseTotal, hotelCurrency), emphasize: false },
          { label: 'Rate plan adjustment', value: formatMoney(ratePlanAdjustmentTotal, hotelCurrency), emphasize: ratePlanAdjustmentTotal !== 0 },
          { label: 'Mandatory fees', value: formatMoney(mandatoryFeesTotal, hotelCurrency), emphasize: mandatoryFeesTotal > 0 },
          { label: 'Optional extras', value: formatMoney(optionalExtrasTotal, hotelCurrency), emphasize: optionalExtrasTotal > 0 },
          { label: 'Final customer quote', value: formatMoney(finalTotal, hotelCurrency), emphasize: true },
        ];
        const sourceLabel = (value) => {
          const raw = String(value || '').trim().toLowerCase();
          if (raw === 'date') return 'Exact date';
          if (raw === 'month') return 'Month';
          if (raw === 'weekday') return 'Weekday';
          return 'Base';
        };
        const extrasHtml = appliedExtras.length ? `
          <div class="partner-details-breakdown-subsection">
            <div class="partner-details-breakdown-subtitle">Applied extras</div>
            <div class="partner-details-extra-list">
              ${appliedExtras.map((item) => `
                <div class="partner-details-extra-row">
                  <span>${escapeHtml(localizedLabelFromValue(item?.label, 'en') || item?.id || 'Extra')}${item?.is_mandatory ? ' (mandatory)' : ''}</span>
                  <strong>${escapeHtml(formatMoney(item?.total, hotelCurrency))}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '';
        const nightlyHtml = nightlyRates.length ? `
          <div class="partner-details-breakdown-subsection">
            <div class="partner-details-breakdown-subtitle">Nightly pricing</div>
            <div class="partner-details-nightly-list">
              ${nightlyRates.map((entry) => `
                <div class="partner-details-nightly-row">
                  <div>
                    <div class="partner-details-nightly-date">${escapeHtml(entry?.date ? formatDateDmy(entry.date) : 'Night')}</div>
                    <span class="partner-details-rate-source partner-details-rate-source--${escapeHtml(String(entry?.source || 'base').trim().toLowerCase() || 'base')}">${escapeHtml(sourceLabel(entry?.source))}</span>
                  </div>
                  <div class="partner-details-nightly-price-wrap">
                    <span class="partner-details-nightly-base">${escapeHtml(formatMoney(entry?.baseRate, hotelCurrency))}</span>
                    <strong class="partner-details-nightly-final">${escapeHtml(formatMoney(entry?.rate, hotelCurrency))}</strong>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '';
        return `
          <div class="partner-details-section">
            <h3 class="partner-details-section__title">Quote breakdown</h3>
            <div class="partner-details-breakdown-grid">
              ${rows.map((row) => `
                <div class="partner-details-breakdown-card${row.emphasize ? ' partner-details-breakdown-card--emphasis' : ''}">
                  <div class="partner-details-breakdown-label">${escapeHtml(row.label)}</div>
                  <div class="partner-details-breakdown-value">${escapeHtml(row.value)}</div>
                </div>
              `).join('')}
            </div>
            ${extrasHtml}
            ${nightlyHtml}
          </div>
        `;
      })();

      const hotelDecisionHtml = (() => {
        if (category !== 'hotels') return '';
        const configuredUnits = hotelDecisionSupport?.configuredUnits ?? null;
        const overlappingOtherRequests = hotelDecisionSupport?.overlappingOtherRequests ?? null;
        const totalOverlappingIncludingThis = hotelDecisionSupport?.totalOverlappingIncludingThis ?? null;
        const unitsLeftAfterThis = hotelDecisionSupport?.unitsLeftAfterThis ?? null;
        const exceedsInventory = Boolean(hotelDecisionSupport?.exceedsConfiguredInventory);
        const cards = [
          { label: 'Configured units', value: configuredUnits != null ? String(configuredUnits) : 'Not set' },
          { label: 'Other overlapping requests', value: overlappingOtherRequests != null ? String(overlappingOtherRequests) : '—' },
          { label: 'Total units needed incl. this request', value: totalOverlappingIncludingThis != null ? String(totalOverlappingIncludingThis) : '—' },
          { label: 'Estimated units left', value: unitsLeftAfterThis != null ? String(unitsLeftAfterThis) : '—' },
        ];
        const note = exceedsInventory
          ? 'Configured room inventory is lower than the current overlapping request load. Review before accepting.'
          : 'Inventory is internal only. Customers do not see this availability; use it only for partner-side decision making.';
        return `
          <div class="partner-details-section">
            <h3 class="partner-details-section__title">Room inventory context</h3>
            <div class="partner-details-breakdown-grid">
              ${cards.map((card) => `
                <div class="partner-details-breakdown-card${exceedsInventory && card.label === 'Estimated units left' ? ' partner-details-breakdown-card--warning' : ''}">
                  <div class="partner-details-breakdown-label">${escapeHtml(card.label)}</div>
                  <div class="partner-details-breakdown-value">${escapeHtml(card.value)}</div>
                </div>
              `).join('')}
            </div>
            <div class="partner-details-inline-note${exceedsInventory ? ' partner-details-inline-note--warning' : ''}">${escapeHtml(note)}</div>
          </div>
        `;
      })();

      const hotelRoomGalleryHtml = (() => {
        if (category !== 'hotels') return '';
        const locationHtml = hotelLocationSummary
          ? `
            <div class="partner-details-breakdown-subsection">
              <div class="partner-details-breakdown-subtitle">Location</div>
              <div class="partner-details-inline-note">
                <span>${escapeHtml(hotelLocationSummary)}</span>
                ${hotelMapsUrl ? `<a href="${escapeHtml(hotelMapsUrl)}" target="_blank" rel="noopener">Open in Google Maps</a>` : ''}
              </div>
            </div>
          `
          : '';
        const galleryHtml = hotelRoomGalleryUrls.length ? `
          <div class="partner-details-breakdown-subsection">
            <div class="partner-details-breakdown-subtitle">Room gallery</div>
            <div class="partner-details-hotel-gallery">
              ${hotelRoomGalleryUrls.slice(0, 6).map((url, index) => `
                <figure class="partner-details-hotel-gallery-item">
                  <img src="${escapeHtml(url)}" alt="${escapeHtml(`${hotelRoomTypeName || 'Room'} ${index + 1}`)}" loading="lazy" />
                </figure>
              `).join('')}
            </div>
          </div>
        ` : '';
        if (!galleryHtml && !locationHtml) return '';
        return `
          <div class="partner-details-section">
            <h3 class="partner-details-section__title">Room and map</h3>
            ${galleryHtml}
            ${locationHtml}
          </div>
        `;
      })();

      const notesPairs = (() => {
        const candidates = ['notes', 'special_requests', 'customer_notes'];
        const v = candidates.map((k) => getField(k)).find((x) => !isEmptyFormValue(x));
        if (isEmptyFormValue(v)) return [];
        return [{ label: 'Notes', value: v, kind: 'pre' }];
      })();

      const carsOverviewHtml = (() => {
        if (category !== 'cars') return '';

        const pickupDate = formatDateLabel(getField('pickup_date'));
        const pickupTime = formatTimeLabel(getField('pickup_time'));
        const pickupLocation = formatLocationLabel(getField('pickup_location'));
        const returnDate = formatDateLabel(getField('return_date'));
        const returnTime = formatTimeLabel(getField('return_time'));
        const returnLocation = formatLocationLabel(getField('return_location'));
        const rentalDays = calculateCarDurationDays(f, snapshotPayload);
        const pricing = getCarsFulfillmentPricing(f);
        const totalPrice = pricing.amount != null ? formatMoney(pricing.amount, pricing.currency) : '';
        const model = String(getField('car_model') || '').trim();

        const pickupLine = [pickupDate, pickupTime, pickupLocation].filter((x) => String(x || '').trim()).join(' · ');
        const returnLine = [returnDate, returnTime, returnLocation].filter((x) => String(x || '').trim()).join(' · ');
        const rentalLine = [model, rentalDays != null ? `${rentalDays} day(s)` : ''].filter(Boolean).join(' · ');

        const cards = [
          { label: 'Pickup', value: pickupLine || '—' },
          { label: 'Return', value: returnLine || '—' },
          { label: 'Rental', value: rentalLine || '—' },
          { label: pricing.hasCoupon ? 'Final rental total' : 'Suggested total', value: totalPrice || '—' },
        ];

        return `
          <div class="partner-details-overview-grid">
            ${cards.map((c) => `
              <div class="partner-details-overview-card">
                <div class="partner-details-overview-label">${escapeHtml(c.label)}</div>
                <div class="partner-details-overview-value">${escapeHtml(c.value)}</div>
              </div>
            `).join('')}
          </div>
        `;
      })();

      const additionalPairs = (() => {
        const shouldSkipAdditionalKey = (key) => {
          const nk = normalizeFormKey(key);
          if (category === 'cars' && (nk === 'durationdays' || nk === 'duration')) return true;
          return false;
        };

        const combinedPayload = {
          ...(detailsPayload && typeof detailsPayload === 'object' ? detailsPayload : {}),
          ...(snapshotPayload && typeof snapshotPayload === 'object' ? snapshotPayload : {}),
        };
        if (!combinedPayload || typeof combinedPayload !== 'object') return [];
        return Object.entries(combinedPayload)
          .filter(([k, v]) => {
            if (!String(k || '').trim() || usedKeys.has(k) || isEmptyFormValue(v)) return false;
            if (shouldSkipAdditionalKey(k)) return false;
            if (!isContactRevealed && isSensitiveFormKey(k)) return false;
            return true;
          })
          .sort(([a], [b]) => String(a).localeCompare(String(b)))
          .map(([k, v]) => ({ label: labelForFormKey(k) || k, value: v }));
      })();

      const contactHiddenNotice = !isContactRevealed
        ? '<div class="partner-details-notice">Customer name, surname, email and phone are hidden until payment confirmation.</div>'
        : '';

      const html = [
        contactHiddenNotice,
        carsOverviewHtml,
        hotelOverviewHtml,
        sectionHtml('Customer information', customerSectionPairs),
        category === 'shop' ? sectionHtml('Shipping', shippingSectionPairs) : '',
        category === 'shop' ? sectionHtml('Billing', billingSectionPairs) : '',
        category === 'cars' ? sectionHtml('Rental details', carsRentalPairs) : '',
        category === 'cars' ? sectionHtml('Pickup', carsPickupPairs) : '',
        category === 'cars' ? sectionHtml('Return', carsReturnPairs) : '',
        category === 'hotels' ? hotelPricingHtml : '',
        category === 'hotels' ? hotelDecisionHtml : '',
        category === 'hotels' ? hotelRoomGalleryHtml : '',
        category === 'hotels' ? sectionHtml('Stay details', hotelsStayPairs) : '',
        category === 'trips' ? sectionHtml('Trip details', tripsDetailsPairs) : '',
        category === 'transport' ? transportOverviewHtml : '',
        category === 'transport' ? sectionHtml('Trip details', transportTripPairs) : '',
        category === 'transport' ? sectionHtml('Passengers and luggage', transportPassengersPairs) : '',
        category === 'transport' ? sectionHtml('Outbound trip', transportOutboundPairs) : '',
        category === 'transport' ? sectionHtml('Return trip', transportReturnPairs) : '',
        notesPairs.length ? sectionHtml('Notes', notesPairs) : '',
        additionalPairs.length ? sectionHtml('Additional information', additionalPairs) : '',
      ].filter(Boolean).join('');

      if (els.partnerDetailsBody) {
        els.partnerDetailsBody.setAttribute('data-category', category || '');
        els.partnerDetailsBody.innerHTML = html || '<div class="muted">No customer details available.</div>';
        els.partnerDetailsBody.scrollTop = 0;
      }

      if (els.partnerDetailsActions) {
        const source = String(f.__source || 'shop').trim().toLowerCase();
        const currentFlowStatus = String(f.status || '').trim().toLowerCase();
        const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
        const isSuspended = Boolean(partner?.status === 'suspended');
        let actionHtml = '';

        if (currentFlowStatus === 'pending_acceptance') {
          actionHtml = `
            <button class="btn-action btn-success" type="button" data-modal-fulfillment-action="accept" ${isSuspended ? 'disabled' : ''}>Accept request</button>
            <button class="btn-action btn-danger" type="button" data-modal-fulfillment-action="reject" ${isSuspended ? 'disabled' : ''}>Reject request</button>
            <div class="partner-details-actions-note">Use the full quote and room context above before deciding.</div>
          `;
        } else if (currentFlowStatus === 'awaiting_payment') {
          actionHtml = '<div class="partner-details-actions-note">This request is already accepted and is waiting for payment confirmation.</div>';
        } else if (currentFlowStatus === 'accepted') {
          actionHtml = '<div class="partner-details-actions-note">This request has already been accepted.</div>';
        } else if (currentFlowStatus === 'rejected') {
          actionHtml = '<div class="partner-details-actions-note">This request has already been rejected.</div>';
        } else if (currentFlowStatus === 'closed') {
          actionHtml = '<div class="partner-details-actions-note">This request was accepted by another partner.</div>';
        } else if (currentFlowStatus === 'expired') {
          actionHtml = '<div class="partner-details-actions-note">This request expired before acceptance.</div>';
        }

        els.partnerDetailsActions.hidden = !actionHtml;
        els.partnerDetailsActions.innerHTML = actionHtml;

        els.partnerDetailsActions.querySelectorAll('[data-modal-fulfillment-action]').forEach((button) => {
          button.addEventListener('click', () => {
            const action = String(button.getAttribute('data-modal-fulfillment-action') || '').trim().toLowerCase();
            if (!action || !els.fulfillmentsBody) return;
            const rowButton = els.fulfillmentsBody.querySelector(`button[data-action="${action}"][data-source="${source}"][data-id="${id}"]`);
            if (!(rowButton instanceof HTMLButtonElement)) return;
            closePartnerDetailsModal({ restoreFocus: false });
            rowButton.click();
          });
        });
      }
    };

    const formSnapshotHtml = (payload) => {
      if (!payload || typeof payload !== 'object') return '';
      const entries = Object.entries(payload)
        .filter(([k, v]) => String(k || '').trim() && !isEmptyFormValue(v))
        .sort(([a], [b]) => String(a).localeCompare(String(b)));
      if (!entries.length) return '';

      const rows = entries.map(([k, v]) => {
        const label = labelForFormKey(k) || String(k);
        const valueHtml = renderFormValue(v);
        return `<div class="small" style="margin-top:4px;"><strong>${escapeHtml(label)}:</strong> ${valueHtml}</div>`;
      }).join('');

      return `
        <div class="partner-contact" style="margin-top: 10px;">
          <strong>Form</strong>
          ${rows}
        </div>
      `;
    };

    const rowsHtml = filtered
      .map((f) => {
        const source = String(f.__source || 'shop');
        const isShop = source === 'shop';
        const id = f.id;
        const items = isShop ? (state.itemsByFulfillmentId[id] || []) : [];
        const contact = state.contactsByFulfillmentId[id] || null;
        const formSnapshot = state.formSnapshotsByFulfillmentId[id] || null;
        const snapshotPayload = (formSnapshot?.payload && typeof formSnapshot.payload === 'object') ? formSnapshot.payload : null;

        const durationDays = calculateCarDurationDays(f, snapshotPayload);

        const datesHtml = (() => {
          if (isShop) return '<span class="muted">—</span>';

          if (normalizeServiceResourceType(f.resource_type) === 'trips') {
            const details = (f.details && typeof f.details === 'object') ? f.details : null;
            const preferred = details?.preferred_date || details?.preferredDate || details?.trip_date || details?.tripDate || null;
            const arrival = details?.arrival_date || details?.arrivalDate || null;
            const departure = details?.departure_date || details?.departureDate || null;
            const adults = details?.num_adults ?? details?.numAdults ?? null;
            const children = details?.num_children ?? details?.numChildren ?? null;
            const proposedRaw = Array.isArray(details?.partner_proposed_dates)
              ? details.partner_proposed_dates
              : Array.isArray(details?.proposed_dates)
                ? details.proposed_dates
                : [];
            const proposedDates = Array.from(new Set(
              proposedRaw
                .map((v) => normalizeIsoDateValue(v))
                .filter(Boolean)
            )).slice(0, 3);
            const selectionStatusRaw = String(details?.trip_date_selection_status || '').trim().toLowerCase();
            const selectionStatusLabel = (() => {
              if (selectionStatusRaw === 'options_proposed') return 'Options proposed by partner';
              if (selectionStatusRaw === 'options_sent_to_customer') return 'Options sent to customer';
              if (selectionStatusRaw === 'selected') return 'Customer selected date';
              if (selectionStatusRaw === 'not_required') return 'Date selection not required';
              return selectionStatusRaw ? selectionStatusRaw.replace(/_/g, ' ') : '';
            })();
            const selectedDate = normalizeIsoDateValue(
              details?.selected_trip_date
              || details?.trip_date_selection_date
              || ''
            );
            const optionsSentAtLabel = (() => {
              const raw = details?.trip_date_options_sent_at || details?.trip_date_selection_sent_at || '';
              return raw ? formatDateTime(raw) : '';
            })();
            const optionsExpiryLabel = (() => {
              const raw = details?.trip_date_options_expires_at || details?.trip_date_selection_expires_at || '';
              return raw ? formatDateTime(raw) : '';
            })();

            const preferredHtml = preferred
              ? `<div class="small"><strong>Preferred Date:</strong> ${escapeHtml(formatDateDmy(preferred))}</div>`
              : '';

            const stayHtml = (arrival || departure)
              ? `<div class="small"><strong>Stay on Cyprus:</strong> ${escapeHtml(`${formatDateDmy(arrival)} → ${formatDateDmy(departure)}`)}</div>`
              : (f.start_date && f.end_date)
                ? `<div class="small">${escapeHtml(`${formatDate(f.start_date)} → ${formatDate(f.end_date)}`)}</div>`
                : '';

            const participantsHtml = (adults != null || children != null)
              ? `<div class="small"><strong>Participants:</strong> ${escapeHtml(`${Number(adults || 0)} adult(s), ${Number(children || 0)} child(ren)`)}</div>`
              : '';

            const proposedHtml = proposedDates.length
              ? `<div class="small"><strong>Available options:</strong> ${escapeHtml(proposedDates.map((iso) => formatDateDmy(iso)).join(', '))}</div>`
              : '';
            const selectionHtml = selectionStatusLabel
              ? `<div class="small"><strong>Date flow:</strong> ${escapeHtml(selectionStatusLabel)}</div>`
              : '';
            const selectedHtml = selectedDate
              ? `<div class="small"><strong>Selected date:</strong> ${escapeHtml(formatDateDmy(selectedDate))}</div>`
              : '';
            const sentHtml = optionsSentAtLabel
              ? `<div class="small"><strong>Sent to customer:</strong> ${escapeHtml(optionsSentAtLabel)}</div>`
              : '';
            const expiresHtml = optionsExpiryLabel
              ? `<div class="small"><strong>Selection link expires:</strong> ${escapeHtml(optionsExpiryLabel)}</div>`
              : '';

            const parts = [preferredHtml, stayHtml, participantsHtml, proposedHtml, selectionHtml, sentHtml, expiresHtml, selectedHtml].filter(Boolean).join('');
            return parts || '<span class="muted">—</span>';
          }

          if (normalizeServiceResourceType(f.resource_type) === 'transport') {
            const details = detailsObjectFromFulfillment(f) || {};
            const booking = state.transportBookingsById[String(f?.booking_id || '').trim()] || null;
            const outboundDate = booking?.travel_date || details?.travel_date || details?.travelDate || f.start_date || null;
            const outboundTime = booking?.travel_time || details?.travel_time || details?.travelTime || null;
            const returnDate = booking?.return_travel_date || details?.return_travel_date || details?.returnTravelDate || f.end_date || null;
            const returnTime = booking?.return_travel_time || details?.return_travel_time || details?.returnTravelTime || null;
            const tripType = String(booking?.trip_type || details?.trip_type || '').trim().toLowerCase();
            const hasReturn = tripType === 'round_trip'
              || Boolean(
                booking?.return_route_id
                || details?.return_route_id
                || returnDate
                || returnTime
                || booking?.return_pickup_address
                || details?.return_pickup_address
              );

            const outboundParts = [
              outboundDate ? formatDateDmy(outboundDate) : '',
              outboundTime ? String(outboundTime).slice(0, 5) : '',
            ].filter(Boolean);
            const returnParts = [
              returnDate ? formatDateDmy(returnDate) : '',
              returnTime ? String(returnTime).slice(0, 5) : '',
            ].filter(Boolean);

            const outboundLine = outboundParts.length ? outboundParts.join(' · ') : '—';
            if (!hasReturn) {
              return `<div class="small"><strong>Outbound:</strong> ${escapeHtml(outboundLine)}</div>`;
            }
            const returnLine = returnParts.length ? returnParts.join(' · ') : '—';
            return `
              <div class="small"><strong>Outbound:</strong> ${escapeHtml(outboundLine)}</div>
              <div class="small"><strong>Return:</strong> ${escapeHtml(returnLine)}</div>
            `;
          }

          if (f.start_date && f.end_date) {
            const durationHtml = (durationDays != null)
              ? `<div class="muted small">Duration: ${escapeHtml(String(durationDays))} day(s)</div>`
              : '';
            return `<div class="small">${escapeHtml(`${formatDate(f.start_date)} → ${formatDate(f.end_date)}`)}</div>${durationHtml}`;
          }
          return '<span class="muted">—</span>';
        })();

        const priceHtml = (() => {
          if (!isShop) {
            const pricing = getCarsFulfillmentPricing(f);
            const val = escapeHtml(formatMoney(pricing.amount, pricing.currency));
            const discountLabel = pricing.discountAmount > 0
              ? ` (−${escapeHtml(formatMoney(pricing.discountAmount, pricing.currency))})`
              : '';
            const couponHint = pricing.hasCoupon
              ? `<div class="small" style="margin-top:4px; opacity:0.9;">Coupon ${escapeHtml(pricing.couponCode || 'applied')}${discountLabel}</div>`
              : '';
            if (String(f.resource_type || '') === 'cars') {
              return `
                <div class="muted small">${pricing.hasCoupon ? 'Final Rental Total' : 'Suggested Total'}</div>
                <div class="small" style="margin-top:6px; padding:8px 10px; border-radius:10px; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#fff; font-weight:700; display:inline-block;">${val}</div>
                ${couponHint}
              `;
            }
            return `<span class="small">${val}</span>${couponHint}`;
          }

          const allocated = f.total_allocated != null ? Number(f.total_allocated) : null;
          const subtotal = f.subtotal != null ? Number(f.subtotal) : null;
          const value = (allocated != null && Number.isFinite(allocated))
            ? allocated
            : ((subtotal != null && Number.isFinite(subtotal)) ? subtotal : null);
          return value != null
            ? `<span class="small">${escapeHtml(formatMoney(value, 'EUR'))}</span>`
            : '<span class="muted">—</span>';
        })();

        const itemsSummary = (() => {
          if (!isShop) {
            const typeLabel = f.resource_type ? String(f.resource_type) : 'service';
            const summary = f.summary ? String(f.summary) : 'Booking';
            return `
              <div class="small"><strong>${escapeHtml(typeLabel)}</strong></div>
              <div class="small">${escapeHtml(summary)}</div>
            `;
          }

          if (!items.length) return '<span class="muted">—</span>';

          const parts = items.slice(0, 2).map((it) => {
            const name = it.product_name || 'Product';
            const variant = it.variant_name ? ` (${it.variant_name})` : '';
            const qty = Number(it.quantity || 0);
            return `${escapeHtml(name)}${escapeHtml(variant)} × ${qty}`;
          });
          const more = items.length > 2 ? ` +${items.length - 2} more` : '';
          const moreHtml = more ? `<div class="muted small">${escapeHtml(more)}</div>` : '';
          return `${parts.join('<br/>')}${moreHtml}`;
        })();

        const detailsBtnHtml = (() => {
          const hasContact = Boolean(contact && (contact.customer_name || contact.customer_email || contact.customer_phone || contact.shipping_address || contact.billing_address));
          const hasSnapshot = Boolean(formSnapshot && formSnapshot.payload && typeof formSnapshot.payload === 'object' && Object.keys(formSnapshot.payload).length);
          const parsedDetails = detailsObjectFromFulfillment(f);
          const hasDetails = Boolean(parsedDetails && Object.keys(parsedDetails).length);
          const hasHotelContext = !isShop
            && normalizeServiceResourceType(f.resource_type) === 'hotels'
            && Boolean(
              state.hotelBookingsById[String(f.booking_id || '').trim()]
              || state.hotelResourcesById[String(f.resource_id || '').trim()]
            );
          const hasTransportContext = !isShop
            && normalizeServiceResourceType(f.resource_type) === 'transport'
            && Boolean(state.transportBookingsById[String(f.booking_id || '').trim()]);
          if (!hasContact && !hasSnapshot && !hasDetails && !hasHotelContext && !hasTransportContext) return '';
          return `
            <div style="margin-top: 10px;">
              <button
                class="btn-details"
                type="button"
                data-partner-details-open
                data-id="${escapeHtml(id)}"
                data-source="${escapeHtml(source)}"
              >
                Details
              </button>
            </div>
          `;
        })();

        const orderLabel = (() => {
          if (isShop) {
            return f.order_number ? escapeHtml(f.order_number) : escapeHtml(String(f.order_id || '').slice(0, 8));
          }
          if (f.reference) return escapeHtml(String(f.reference));
          return escapeHtml(String(f.booking_id || '').slice(0, 8));
        })();

        const actionsHtml = (() => {
          const st = String(f.status || '');
          if (st === 'closed') {
            return '<div class="muted small">Accepted by another partner</div>';
          }
          if (st !== 'pending_acceptance') {
            if (st === 'accepted' && f.contact_revealed_at) {
              return '<div class="muted small">Contact revealed</div>';
            }
            if (st === 'expired') {
              return '<div class="muted small">Deposit expired</div>';
            }
            if (st === 'rejected' && f.rejected_reason) {
              return `<div class="muted small">Reason: ${escapeHtml(f.rejected_reason)}</div>`;
            }
            return '<div class="muted">—</div>';
          }

          const disabledAttr = isSuspended ? 'disabled' : '';

          return `
            <div class="btn-row">
              <button class="btn-action btn-success" type="button" data-action="accept" data-source="${escapeHtml(source)}" data-id="${escapeHtml(id)}" ${disabledAttr}>Accept</button>
              <button class="btn-action btn-danger" type="button" data-action="reject" data-source="${escapeHtml(source)}" data-id="${escapeHtml(id)}" ${disabledAttr}>Reject</button>
            </div>
          `;
        })();

        const rejectedInfo = String(f.status) === 'rejected' && f.rejected_reason
          ? `<div class="muted small" style="margin-top:6px;">${escapeHtml(f.rejected_reason)}</div>`
          : '';
        const resolvedStatus = (!isShop && source === 'service')
          ? resolveServiceOrderStatus(f)
          : String(f.status || '').trim().toLowerCase();
        const fulfillmentStatusHint = (!isShop && source === 'service')
          ? `<div class="muted small" style="margin-top:6px;">Flow: ${escapeHtml(String(f.status || '').replace(/_/g, ' ') || '—')}</div>`
          : '';

        return `
          <tr data-fulfillment-id="${escapeHtml(id)}">
            <td>
              <strong>${orderLabel}</strong>
              <div class="muted small">Created: ${escapeHtml(formatDate(f.created_at))}</div>
            </td>
            <td>
              ${statusBadge(resolvedStatus || f.status)}
              ${fulfillmentStatusHint}
              ${rejectedInfo}
            </td>
            <td>${datesHtml}</td>
            <td>${priceHtml}</td>
            <td>
              ${itemsSummary}
              ${detailsBtnHtml}
            </td>
            <td>${actionsHtml}</td>
          </tr>
        `;
      })
      .join('');

    setHtml(els.fulfillmentsBody, rowsHtml);

    els.fulfillmentsBody.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const fulfillmentId = btn.getAttribute('data-id');
        const source = btn.getAttribute('data-source') || 'shop';
        if (!action || !fulfillmentId) return;

        try {
          if (action === 'reject') {
            const row = (state.fulfillments || []).find((f) => String(f?.id || '') === String(fulfillmentId)) || null;
            const isTransportServiceReject = source === 'service'
              && String(row?.resource_type || '').trim().toLowerCase() === 'transport';
            let reason = '';
            let reasonCode = '';

            if (isTransportServiceReject) {
              const picked = promptTransportRejectReason();
              if (!picked) return;
              reason = String(picked.reason || '').trim();
              reasonCode = String(picked.reasonCode || '').trim();
            } else {
              reason = String(prompt('Provide a rejection reason (optional):') || '').trim();
            }

            if (!confirm('Are you sure you want to reject this fulfillment?')) return;
            btn.disabled = true;
            let result = null;
            if (source === 'service') {
              result = await callServiceFulfillmentAction(fulfillmentId, 'reject', reason, reasonCode);
            } else {
              result = await callFulfillmentAction(fulfillmentId, 'reject', reason);
            }
            const msg = messageForFulfillmentAction('reject', result);
            const tone = result && typeof result === 'object' && result.skipped ? 'info' : 'success';
            showToast(msg, tone);
          } else {
            const row = (state.fulfillments || []).find((f) => String(f?.id || '') === String(fulfillmentId)) || null;
            const isTripServiceAccept = source === 'service'
              && normalizeServiceResourceType(row?.resource_type) === 'trips';
            let extraPayload = null;

            if (isTripServiceAccept) {
              const proposedDates = await promptTripAvailableDates(row);
              if (!proposedDates || !proposedDates.length) return;
              extraPayload = { proposed_dates: proposedDates };
            }

            const acceptMessage = isTripServiceAccept
              ? 'Accepting will send available dates directly to customer email. Customer chooses one date and pays deposit to confirm. Continue?'
              : 'Accepting will request a customer deposit payment. Contact details will be revealed after payment confirmation. Continue?';
            if (!confirm(acceptMessage)) return;

            btn.disabled = true;
            let result = null;
            if (source === 'service') {
              result = await callServiceFulfillmentAction(fulfillmentId, 'accept', '', '', extraPayload);
            } else {
              result = await callFulfillmentAction(fulfillmentId, 'accept');
            }
            const msg = messageForFulfillmentAction('accept', result);
            const tone = result && typeof result === 'object' && result.skipped ? 'info' : 'success';
            showToast(msg, tone);

            const tripSelectionRequired = Boolean(
              isTripServiceAccept
              && result
              && typeof result === 'object'
              && result.data
              && typeof result.data === 'object'
              && result.data.trip_date_selection_required
            );
            const tripSelectionStatus = String(
              (result && typeof result === 'object' && result.data && typeof result.data === 'object'
                ? result.data.trip_date_selection_status
                : '') || ''
            ).trim().toLowerCase();

            if (
              isTripServiceAccept
              && result
              && typeof result === 'object'
              && result.ok !== false
              && (tripSelectionRequired || tripSelectionStatus === 'options_proposed')
            ) {
              try {
                const bookingId = String(result?.data?.booking_id || '').trim();
                const sendRes = await dispatchTripDateOptionsToCustomer(fulfillmentId, bookingId);
                const expiresAt = String(sendRes?.data?.data?.expires_at || '').trim();
                showToast(
                  expiresAt
                    ? `Date options sent to customer email (expires ${expiresAt}).`
                    : 'Date options sent to customer email.',
                  'success'
                );
              } catch (dispatchError) {
                console.error(dispatchError);
                showToast(`Accepted, but failed to send date options: ${dispatchError.message || 'unknown error'}`, 'error');
              }
            }
          }

          await refreshFulfillments();
        } catch (error) {
          console.error(error);
          showToast(`Error: ${error.message || 'Action failed'}`, 'error');
          btn.disabled = false;
        }
      });
    });

    els.fulfillmentsBody.querySelectorAll('button[data-partner-details-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fid = String(btn.getAttribute('data-id') || '').trim();
        if (!fid) return;
        const f = (state.fulfillments || []).find((row) => String(row?.id || '') === fid) || null;
        renderPartnerDetailsIntoModal(f);
        openPartnerDetailsModal();
      });
    });

    focusFulfillmentRowFromHash();
  }

  async function loadBlocks() {
    if (!state.selectedPartnerId) return;

    const { data, error } = await state.sb
      .from('partner_availability_blocks')
      .select('id, resource_type, resource_id, start_date, end_date, note, created_at')
      .eq('partner_id', state.selectedPartnerId)
      .order('start_date', { ascending: false })
      .limit(200);

    if (error) throw error;
    state.blocks = Array.isArray(data) ? data : [];
  }

  function normalizeTitleJson(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value.pl || value.en || value.el || value.he || '';
    return '';
  }

  function slugifyText(value) {
    return String(value || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parsePartnerBlogCsv(value) {
    return Array.from(new Set(
      String(value || '')
        .split(',')
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    ));
  }

  function normalizePartnerBlogTaxonomyList(value) {
    return Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
  }

  function normalizePartnerBlogServiceType(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (!raw) return '';
    if (PARTNER_BLOG_SERVICE_TYPE_ALIASES[raw]) return raw;
    for (const [canonical, aliases] of Object.entries(PARTNER_BLOG_SERVICE_TYPE_ALIASES)) {
      if (aliases.includes(raw)) return canonical;
    }
    return '';
  }

  function isMissingPartnerBlogTaxonomySchemaError(error) {
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

  async function executePartnerBlogTaxonomyFallback(primaryFactory, legacyFactory) {
    const primary = await primaryFactory();
    if (!primary?.error || !isMissingPartnerBlogTaxonomySchemaError(primary.error) || typeof legacyFactory !== 'function') {
      return primary;
    }
    return legacyFactory();
  }

  function stripPartnerBlogTaxonomyPayload(payload) {
    const next = { ...(payload || {}) };
    delete next.categories_pl;
    delete next.categories_en;
    delete next.tags_pl;
    delete next.tags_en;
    return next;
  }

  function getPartnerBlogTaxonomyValuesFromPost(post, kind, lang) {
    const direct = normalizePartnerBlogTaxonomyList(post?.[`${kind}_${lang}`]);
    if (direct.length) {
      return direct;
    }
    return normalizePartnerBlogTaxonomyList(post?.[kind]);
  }

  function getPartnerBlogTaxonomyRefs(kind, lang) {
    const kindLabel = kind === 'categories' ? 'Categories' : 'Tags';
    const langLabel = lang === 'pl' ? 'Pl' : 'En';
    return {
      input: els[`partnerBlogForm${kindLabel}${langLabel}`],
      selected: els[`partnerBlogForm${kindLabel}${langLabel}Selected`],
      composer: els[`partnerBlogForm${kindLabel}${langLabel}Input`],
      suggestions: els[`partnerBlogForm${kindLabel}${langLabel}Suggestions`],
    };
  }

  function firstSentenceText(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    const match = text.match(/^.*?[.!?](?:\s|$)/);
    return String(match ? match[0] : text).trim();
  }

  function createEmptyPartnerBlogDoc() {
    return { type: 'doc', content: [] };
  }

  function createPartnerBlogTranslations(seed = null) {
    const base = {};
    PARTNER_BLOG_LANGUAGES.forEach((lang) => {
      const current = seed?.[lang.code] || {};
      base[lang.code] = {
        id: current.id || null,
        slug: String(current.slug || '').trim(),
        title: String(current.title || '').trim(),
        lead: String(current.lead || '').trim(),
        content_html: String(current.content_html || '').trim(),
        content_json: current.content_json || createEmptyPartnerBlogDoc(),
      };
    });
    return base;
  }

  function resetPartnerBlogDirtyState() {
    state.partnerBlog.dirtyByLang = {
      pl: { title: false, slug: false, lead: false, content_html: false },
      en: { title: false, slug: false, lead: false, content_html: false },
    };
    state.partnerBlog.slugDirtyByLang = { pl: false, en: false };
  }

  function normalizePartnerBlogRow(row) {
    const translations = {};
    (Array.isArray(row?.translations) ? row.translations : []).forEach((translation) => {
      const lang = String(translation?.lang || '').trim().toLowerCase();
      if (!lang) return;
      translations[lang] = {
        id: translation?.id || null,
        slug: String(translation?.slug || '').trim(),
        title: String(translation?.title || '').trim(),
        lead: String(translation?.lead || '').trim(),
        content_html: String(translation?.content_html || '').trim(),
        content_json: translation?.content_json || createEmptyPartnerBlogDoc(),
      };
    });

    return {
      id: row?.id || '',
      status: String(row?.status || 'draft').trim(),
      submission_status: String(row?.submission_status || 'draft').trim(),
      cover_image_url: String(row?.cover_image_url || '').trim(),
      categories: Array.isArray(row?.categories) ? row.categories.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
      categories_pl: getPartnerBlogTaxonomyValuesFromPost(row, 'categories', 'pl'),
      categories_en: getPartnerBlogTaxonomyValuesFromPost(row, 'categories', 'en'),
      tags: Array.isArray(row?.tags) ? row.tags.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
      tags_pl: getPartnerBlogTaxonomyValuesFromPost(row, 'tags', 'pl'),
      tags_en: getPartnerBlogTaxonomyValuesFromPost(row, 'tags', 'en'),
      cta_services: Array.isArray(row?.cta_services) ? row.cta_services.slice(0, 3).map((entry) => ({
        type: normalizePartnerBlogServiceType(entry?.type),
        resource_id: String(entry?.resource_id || '').trim(),
      })).filter((entry) => entry.type && entry.resource_id) : [],
      owner_partner_id: String(row?.owner_partner_id || '').trim(),
      created_at: row?.created_at || null,
      updated_at: row?.updated_at || null,
      published_at: row?.published_at || null,
      translations,
    };
  }

  function getPartnerBlogDisplayTranslation(post, lang = 'en') {
    return post?.translations?.[lang] || post?.translations?.pl || post?.translations?.en || {};
  }

  function getPartnerBlogCurrentPartner() {
    return state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
  }

  function partnerBlogCanEdit(post) {
    if (!post) return true;
    return String(post.status || '') !== 'published' && String(post.submission_status || '') !== 'approved';
  }

  function partnerBlogBadgeHtml(value, kind = 'status') {
    const normalized = String(value || '').trim().toLowerCase();
    const tone = (
      normalized === 'approved' || normalized === 'published' ? 'success'
        : normalized === 'pending' ? 'warning'
          : normalized === 'rejected' ? 'danger'
            : 'muted'
    );
    const label = kind === 'submission'
      ? (normalized === 'pending' ? 'pending' : normalized || 'draft')
      : normalized || 'draft';
    return `<span class="partner-blog-badge partner-blog-badge--${tone}">${escapeHtml(label)}</span>`;
  }

  function collectPartnerBlogTaxonomySuggestions() {
    const categories = { pl: new Set(), en: new Set() };
    const tags = { pl: new Set(), en: new Set() };
    (state.partnerBlog.items || []).forEach((post) => {
      PARTNER_BLOG_TAXONOMY_LANGUAGES.forEach((lang) => {
        getPartnerBlogTaxonomyValuesFromPost(post, 'categories', lang).forEach((entry) => {
          const value = String(entry || '').trim();
          if (value) categories[lang].add(value);
        });
        getPartnerBlogTaxonomyValuesFromPost(post, 'tags', lang).forEach((entry) => {
          const value = String(entry || '').trim();
          if (value) tags[lang].add(value);
        });
      });
    });
    PARTNER_BLOG_TAXONOMY_LANGUAGES.forEach((lang) => {
      state.partnerBlog.taxonomySuggestions.categories[lang] = Array.from(categories[lang]).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
      state.partnerBlog.taxonomySuggestions.tags[lang] = Array.from(tags[lang]).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    });
  }

  function getPartnerBlogTaxonomyValues(kind, lang) {
    const refs = getPartnerBlogTaxonomyRefs(kind, lang);
    return parsePartnerBlogCsv(refs.input?.value || '');
  }

  function renderPartnerBlogTaxonomyPicker(kind, lang) {
    const values = getPartnerBlogTaxonomyValues(kind, lang);
    const refs = getPartnerBlogTaxonomyRefs(kind, lang);
    const selectedNode = refs.selected;
    const suggestionsNode = refs.suggestions;
    const suggestions = (state.partnerBlog.taxonomySuggestions[kind]?.[lang] || []).filter((entry) => !values.includes(entry)).slice(0, 16);

    if (selectedNode) {
      selectedNode.innerHTML = values.length
        ? values.map((value) => `
          <button class="partner-blog-chip partner-blog-chip--selected" type="button" data-partner-blog-taxonomy-remove="${kind}" data-partner-blog-taxonomy-lang="${lang}" data-value="${escapeHtml(value)}">
            <span>${escapeHtml(value)}</span>
            <span aria-hidden="true">×</span>
          </button>
        `).join('')
        : '<span class="partner-blog-chip-picker__empty">No items selected yet.</span>';
    }

    if (suggestionsNode) {
      suggestionsNode.innerHTML = suggestions.map((value) => `
        <button class="partner-blog-chip" type="button" data-partner-blog-taxonomy-pick="${kind}" data-partner-blog-taxonomy-lang="${lang}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>
      `).join('');
    }
  }

  function setPartnerBlogTaxonomyValues(kind, lang, values) {
    const next = Array.from(new Set((Array.isArray(values) ? values : []).map((entry) => String(entry || '').trim()).filter(Boolean)));
    const refs = getPartnerBlogTaxonomyRefs(kind, lang);
    if (refs.input) refs.input.value = next.join(', ');
    renderPartnerBlogTaxonomyPicker(kind, lang);
  }

  function addPartnerBlogTaxonomyValue(kind, lang, rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return;
    const current = getPartnerBlogTaxonomyValues(kind, lang);
    if (!current.includes(value)) {
      setPartnerBlogTaxonomyValues(kind, lang, current.concat(value));
    }
    const refs = getPartnerBlogTaxonomyRefs(kind, lang);
    if (refs.composer) refs.composer.value = '';
  }

  function removePartnerBlogTaxonomyValue(kind, lang, rawValue) {
    const value = String(rawValue || '').trim();
    setPartnerBlogTaxonomyValues(kind, lang, getPartnerBlogTaxonomyValues(kind, lang).filter((entry) => entry !== value));
  }

  function getPartnerBlogTranslationField(field, lang) {
    const suffix = lang === 'pl' ? 'Pl' : 'En';
    const map = {
      title: `partnerBlogTitle${suffix}`,
      slug: `partnerBlogSlug${suffix}`,
      lead: `partnerBlogLead${suffix}`,
      content_html: `partnerBlogContent${suffix}`,
    };
    const id = map[field];
    return id ? document.getElementById(id) : null;
  }

  function getPartnerBlogEditorValue(lang) {
    const entry = state.partnerBlog.editors.get(lang);
    if (entry?.editor) {
      return {
        content_json: entry.editor.getJSON(),
        content_html: entry.editor.getHTML(),
      };
    }
    const fallback = document.querySelector(`[data-partner-blog-editor-fallback="${lang}"]`);
    return {
      content_json: createEmptyPartnerBlogDoc(),
      content_html: String(fallback?.value || '').trim(),
    };
  }

  function setPartnerBlogTranslationField(field, lang, value) {
    const normalized = String(value || '');
    if (field === 'content_html') {
      const entry = state.partnerBlog.editors.get(lang);
      if (entry?.editor) {
        entry.programmaticUpdate = (entry.programmaticUpdate || 0) + 1;
        entry.editor.commands.setContent(normalized || '<p></p>', false);
        entry.programmaticUpdate = Math.max(0, (entry.programmaticUpdate || 1) - 1);
      }
      const fallback = getPartnerBlogTranslationField(field, lang);
      if (fallback) fallback.value = normalized;
      return;
    }
    const node = getPartnerBlogTranslationField(field, lang);
    if (node) node.value = normalized;
  }

  function getPartnerBlogTranslationValue(field, lang) {
    if (field === 'content_html') {
      return String(getPartnerBlogEditorValue(lang).content_html || '').trim();
    }
    return String(getPartnerBlogTranslationField(field, lang)?.value || '').trim();
  }

  function partnerBlogApplySmartDefaults(lang, changedField = '') {
    const title = getPartnerBlogTranslationValue('title', lang);
    const lead = getPartnerBlogTranslationValue('lead', lang);
    if ((changedField === 'title' || changedField === 'copy') && !state.partnerBlog.slugDirtyByLang[lang]) {
      setPartnerBlogTranslationField('slug', lang, slugifyText(title));
    }
  }

  function switchPartnerBlogLanguage(lang) {
    state.partnerBlog.activeLang = lang === 'en' ? 'en' : 'pl';
    document.querySelectorAll('[data-partner-blog-lang-tab]').forEach((button) => {
      button.classList.toggle('active', String(button.getAttribute('data-partner-blog-lang-tab') || '') === state.partnerBlog.activeLang);
    });
    document.querySelectorAll('[data-partner-blog-lang-content]').forEach((panel) => {
      panel.classList.toggle('active', String(panel.getAttribute('data-partner-blog-lang-content') || '') === state.partnerBlog.activeLang);
    });
  }

  function renderPartnerBlogEditorToolbar(lang) {
    const host = document.querySelector(`[data-partner-blog-editor-toolbar="${lang}"]`);
    if (!host) return;
    const buttons = [
      ['paragraph', 'P'],
      ['heading2', 'H2'],
      ['heading3', 'H3'],
      ['bold', 'B'],
      ['italic', 'I'],
      ['bulletList', '• List'],
      ['orderedList', '1. List'],
      ['blockquote', 'Quote'],
      ['link', 'Link'],
      ['image', 'Image'],
      ['clear', 'Clear'],
    ];
    host.innerHTML = buttons.map(([action, label]) => `
      <button type="button" class="partner-blog-editor-toolbar__btn" data-partner-blog-editor-action="${action}" data-lang="${lang}">
        ${escapeHtml(label)}
      </button>
    `).join('');
  }

  async function ensurePartnerBlogTiptapModules() {
    if (state.partnerBlog.tiptapModules) {
      return state.partnerBlog.tiptapModules;
    }

    if (els.partnerBlogEditorRuntimeNote) {
      els.partnerBlogEditorRuntimeNote.textContent = 'Loading TipTap editor…';
    }

    try {
      const [coreModule, starterKitModule, linkModule, imageModule] = await Promise.all([
        import('https://esm.sh/@tiptap/core@2.26.1'),
        import('https://esm.sh/@tiptap/starter-kit@2.26.1'),
        import('https://esm.sh/@tiptap/extension-link@2.26.1'),
        import('https://esm.sh/@tiptap/extension-image@2.26.1'),
      ]);
      state.partnerBlog.tiptapModules = {
        Editor: coreModule.Editor,
        StarterKit: starterKitModule.default,
        Link: linkModule.default,
        Image: imageModule.default,
      };
      state.partnerBlog.tiptapFallback = false;
      if (els.partnerBlogEditorRuntimeNote) {
        els.partnerBlogEditorRuntimeNote.textContent = 'TipTap editor active';
      }
      return state.partnerBlog.tiptapModules;
    } catch (error) {
      console.warn('[partner-blog] TipTap failed to load, using fallback textarea', error);
      state.partnerBlog.tiptapFallback = true;
      if (els.partnerBlogEditorRuntimeNote) {
        els.partnerBlogEditorRuntimeNote.textContent = 'TipTap unavailable in this environment. HTML fallback enabled.';
      }
      return null;
    }
  }

  function destroyPartnerBlogEditors() {
    state.partnerBlog.editors.forEach((entry) => {
      try {
        entry?.editor?.destroy?.();
      } catch (_e) {
      }
    });
    state.partnerBlog.editors.clear();
  }

  async function initializePartnerBlogEditors(translations) {
    destroyPartnerBlogEditors();
    PARTNER_BLOG_LANGUAGES.forEach((lang) => {
      renderPartnerBlogEditorToolbar(lang.code);
    });
    const modules = await ensurePartnerBlogTiptapModules();

    PARTNER_BLOG_LANGUAGES.forEach((lang) => {
      const translation = translations?.[lang.code] || {};
      const host = document.querySelector(`[data-partner-blog-editor-host="${lang.code}"]`);
      const fallback = document.querySelector(`[data-partner-blog-editor-fallback="${lang.code}"]`);
      if (!host || !fallback) return;

      host.innerHTML = '';
      fallback.hidden = true;

      if (!modules) {
        host.hidden = true;
        fallback.hidden = false;
        fallback.value = String(translation.content_html || '').trim();
        return;
      }

      host.hidden = false;
      const editorMount = document.createElement('div');
      editorMount.className = 'partner-blog-editor-surface';
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
        content: translation.content_json && Object.keys(translation.content_json || {}).length ? translation.content_json : (translation.content_html || ''),
        editorProps: {
          attributes: {
            class: 'partner-blog-editor-surface__inner',
            spellcheck: 'true',
          },
        },
        onUpdate: ({ editor: currentEditor }) => {
          const stateEntry = state.partnerBlog.editors.get(lang.code);
          if (stateEntry?.programmaticUpdate) return;
          fallback.value = currentEditor.getHTML();
          state.partnerBlog.dirtyByLang[lang.code].content_html = true;
        },
      });

      state.partnerBlog.editors.set(lang.code, { editor, programmaticUpdate: 0 });
    });
  }

  function runPartnerBlogEditorCommand(lang, action) {
    const entry = state.partnerBlog.editors.get(lang);
    const editor = entry?.editor;
    if (!editor) return;

    if (action === 'paragraph') editor.chain().focus().setParagraph().run();
    else if (action === 'heading2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (action === 'heading3') editor.chain().focus().toggleHeading({ level: 3 }).run();
    else if (action === 'bold') editor.chain().focus().toggleBold().run();
    else if (action === 'italic') editor.chain().focus().toggleItalic().run();
    else if (action === 'bulletList') editor.chain().focus().toggleBulletList().run();
    else if (action === 'orderedList') editor.chain().focus().toggleOrderedList().run();
    else if (action === 'blockquote') editor.chain().focus().toggleBlockquote().run();
    else if (action === 'link') {
      const current = editor.getAttributes('link')?.href || '';
      const href = window.prompt('Enter link URL', current);
      if (href === null) return;
      const clean = String(href || '').trim();
      if (!clean) editor.chain().focus().unsetLink().run();
      else editor.chain().focus().setLink({ href: clean }).run();
    } else if (action === 'image') {
      const src = window.prompt('Enter image URL');
      if (!src) return;
      editor.chain().focus().setImage({ src: String(src).trim() }).run();
    } else if (action === 'clear') {
      editor.chain().focus().clearContent(true).run();
    }
  }

  function collectPartnerBlogCtaRows() {
    const includeIncomplete = arguments.length > 0 ? Boolean(arguments[0]) : false;
    return Array.from(document.querySelectorAll('.partner-blog-cta-row')).map((row) => ({
      type: normalizePartnerBlogServiceType(row.querySelector('[data-partner-blog-cta-type]')?.value),
      resource_id: String(row.querySelector('[data-partner-blog-cta-resource]')?.value || '').trim(),
    })).filter((entry) => includeIncomplete || (entry.type && entry.resource_id)).slice(0, 3);
  }

  function normalizePartnerBlogResourceRow(type, row) {
    if (type === 'trips') {
      return {
        id: row.id,
        label: normalizeTitleJson(row.title) || row.slug || row.id,
        meta: String(row.start_city || '').trim(),
      };
    }
    if (type === 'hotels') {
      return {
        id: row.id,
        label: normalizeTitleJson(row.title) || row.slug || row.id,
        meta: String(row.city || '').trim(),
      };
    }
    if (type === 'cars') {
      return {
        id: row.id,
        label: normalizeTitleJson(row.car_model) || normalizeTitleJson(row.car_type) || row.id,
        meta: String(row.location || '').trim(),
      };
    }
    if (type === 'pois') {
      return {
        id: row.id,
        label: normalizeTitleJson(row.title) || row.name_en || row.name_pl || row.slug || row.id,
        meta: String(row.location_name || row.city || '').trim(),
      };
    }
    return {
      id: row.id,
      label: String(row.title_en || row.title_pl || row.name_en || row.name_pl || row.slug || row.id).trim(),
      meta: String(row.location_name || row.category || '').trim(),
    };
  }

  async function loadPartnerBlogResourcesForType(type) {
    const normalizedType = normalizePartnerBlogServiceType(type);
    if (!normalizedType || !state.selectedPartnerId) return [];
    if (Array.isArray(state.partnerBlog.resourcesByType[normalizedType])) {
      return state.partnerBlog.resourcesByType[normalizedType];
    }

    const assignedIds = await loadPartnerResourceIdsForType(normalizedType);
    const mergeRows = (...groups) => {
      const merged = [];
      const seen = new Set();
      groups.flat().forEach((row) => {
        const id = String(row?.id || '').trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        merged.push(row);
      });
      return merged;
    };
    const fetchRows = async (tableName, selectClause, ownerField = 'owner_partner_id') => {
      const results = [];
      const { data: ownedData, error: ownedError } = await state.sb
        .from(tableName)
        .select(selectClause)
        .eq(ownerField, state.selectedPartnerId)
        .limit(300);
      if (ownedError) throw ownedError;
      results.push(...(Array.isArray(ownedData) ? ownedData : []));

      if (assignedIds.length) {
        const { data: assignedData, error: assignedError } = await state.sb
          .from(tableName)
          .select(selectClause)
          .in('id', assignedIds)
          .limit(300);
        if (assignedError) throw assignedError;
        results.push(...(Array.isArray(assignedData) ? assignedData : []));
      }

      return mergeRows(results);
    };

    let data = [];
    if (normalizedType === 'trips') {
      data = await fetchRows('trips', 'id, slug, title, start_city');
    } else if (normalizedType === 'hotels') {
      data = await fetchRows('hotels', 'id, slug, title, city');
    } else if (normalizedType === 'cars') {
      data = await fetchRows('car_offers', 'id, car_model, car_type, location');
    } else if (normalizedType === 'pois') {
      const { data: poiData, error } = await state.sb.from('pois').select('*').order('updated_at', { ascending: false }).limit(300);
      if (error) throw error;
      data = Array.isArray(poiData) ? poiData : [];
    } else if (normalizedType === 'recommendations') {
      const { data: recommendationData, error } = await state.sb.from('recommendations').select('*').order('updated_at', { ascending: false }).limit(300);
      if (error) throw error;
      data = Array.isArray(recommendationData) ? recommendationData : [];
    }

    const rows = Array.isArray(data) ? data.map((row) => normalizePartnerBlogResourceRow(normalizedType, row)).filter((row) => row.id) : [];
    state.partnerBlog.resourcesByType[normalizedType] = rows;
    return rows;
  }

  async function populatePartnerBlogResourceOptions(rowNode, type, selectedId = '') {
    const select = rowNode?.querySelector('[data-partner-blog-cta-resource]');
    if (!select) return;
    const normalizedType = normalizePartnerBlogServiceType(type);
    if (!normalizedType) {
      select.innerHTML = '<option value="">Select item</option>';
      return;
    }
    select.innerHTML = '<option value="">Loading…</option>';
    try {
      const rows = await loadPartnerBlogResourcesForType(normalizedType);
      select.innerHTML = `<option value="">Select item</option>${rows.map((row) => {
        const label = row.meta ? `${row.label} — ${row.meta}` : row.label;
        return `<option value="${escapeHtml(row.id)}">${escapeHtml(label)}</option>`;
      }).join('')}`;
      select.value = selectedId || '';
    } catch (error) {
      select.innerHTML = '<option value="">Failed to load items</option>';
      showToast(error?.message || 'Failed to load service items', 'error');
    }
  }

  function renderPartnerBlogCtaRows(rows = []) {
    if (!els.partnerBlogFormCtaRows) return;
    const normalized = Array.isArray(rows) ? rows.slice(0, 3).map((row) => ({
      type: normalizePartnerBlogServiceType(row?.type),
      resource_id: String(row?.resource_id || row?.resourceId || '').trim(),
    })) : [];
    if (!normalized.length) {
      els.partnerBlogFormCtaRows.innerHTML = '<div class="partner-blog-empty-state">No linked services yet. Add up to 3 CTA cards.</div>';
      if (els.btnPartnerBlogAddCta) els.btnPartnerBlogAddCta.disabled = false;
      return;
    }

    els.partnerBlogFormCtaRows.innerHTML = normalized.map((row, index) => `
      <div class="partner-blog-cta-row" data-partner-blog-cta-row data-index="${index}">
        <label class="admin-form-field">
          <span>Service type</span>
          <select data-partner-blog-cta-type>
            <option value="">Select type</option>
            ${PARTNER_BLOG_SERVICE_TYPES.map((service) => `<option value="${escapeHtml(service.type)}" ${service.type === row.type ? 'selected' : ''}>${escapeHtml(service.label)}</option>`).join('')}
          </select>
        </label>
        <label class="admin-form-field">
          <span>Resource</span>
          <select data-partner-blog-cta-resource>
            <option value="">Select item</option>
          </select>
        </label>
        <button class="btn-secondary" type="button" data-partner-blog-cta-remove="${index}">Remove</button>
      </div>
    `).join('');

    Array.from(document.querySelectorAll('.partner-blog-cta-row')).forEach((rowNode, index) => {
      const row = normalized[index] || {};
      void populatePartnerBlogResourceOptions(rowNode, row.type, row.resource_id);
    });

    if (els.btnPartnerBlogAddCta) {
      els.btnPartnerBlogAddCta.disabled = normalized.length >= 3;
    }
  }

  function partnerBlogAddCtaRow() {
    const rows = collectPartnerBlogCtaRows(true);
    if (rows.length >= 3) {
      showToast('You can link up to 3 services', 'warning');
      return;
    }
    rows.push({ type: '', resource_id: '' });
    renderPartnerBlogCtaRows(rows);
  }

  function partnerBlogRemoveCtaRow(index) {
    const rows = collectPartnerBlogCtaRows(true);
    rows.splice(index, 1);
    renderPartnerBlogCtaRows(rows);
  }

  function copyPartnerBlogTranslation(targetLang, sourceLang) {
    const target = targetLang === 'en' ? 'en' : 'pl';
    const source = sourceLang === 'en' ? 'en' : 'pl';
    if (target === source) return;
    const sourceTitle = getPartnerBlogTranslationValue('title', source);
    const sourceLead = getPartnerBlogTranslationValue('lead', source);
    const sourceContent = getPartnerBlogTranslationValue('content_html', source);
    if (!sourceTitle && !sourceLead && !sourceContent) {
      showToast('Nothing to copy from this language yet.', 'warning');
      return;
    }

    const dirtyState = state.partnerBlog.dirtyByLang[target] || {};
    const hasDirtyTarget = Boolean(dirtyState.title || dirtyState.lead || dirtyState.content_html || state.partnerBlog.slugDirtyByLang[target]);
    if (hasDirtyTarget && !window.confirm(`Overwrite the current ${target.toUpperCase()} content with ${source.toUpperCase()} values?`)) {
      return;
    }

    setPartnerBlogTranslationField('title', target, sourceTitle);
    setPartnerBlogTranslationField('lead', target, sourceLead);
    setPartnerBlogTranslationField('content_html', target, sourceContent);
    state.partnerBlog.dirtyByLang[target].title = true;
    state.partnerBlog.dirtyByLang[target].lead = true;
    state.partnerBlog.dirtyByLang[target].content_html = true;
    partnerBlogApplySmartDefaults(target, 'copy');
    switchPartnerBlogLanguage(target);
  }

  function queuePartnerBlogAction(action = 'save') {
    state.partnerBlog.pendingAction = String(action || 'save').trim() || 'save';
    els.partnerBlogForm?.requestSubmit();
  }

  function setPartnerBlogCoverPreview(url) {
    const value = String(url || '').trim();
    if (!els.partnerBlogFormCoverPreview || !els.partnerBlogFormCoverPreviewImage) return;
    if (!value) {
      els.partnerBlogFormCoverPreview.hidden = true;
      els.partnerBlogFormCoverPreviewImage.removeAttribute('src');
      return;
    }
    els.partnerBlogFormCoverPreviewImage.src = value;
    els.partnerBlogFormCoverPreview.hidden = false;
  }

  function ensurePartnerBlogModalPortal() {
    if (!els.partnerBlogModal || typeof document === 'undefined' || !document.body) return;
    if (els.partnerBlogModal.parentElement !== document.body) {
      document.body.appendChild(els.partnerBlogModal);
    }
  }

  async function handlePartnerBlogCoverUpload() {
    const file = els.partnerBlogFormCoverFile?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Image must be smaller than 8MB', 'error');
      return;
    }

    const slugEn = slugifyText(getPartnerBlogTranslationValue('slug', 'en') || getPartnerBlogTranslationValue('title', 'en') || 'partner-blog-post');
    const fileName = `blog/partner-${String(state.selectedPartnerId || 'unknown').slice(0, 12)}/${slugEn || `post-${Date.now()}`}/cover-${Date.now()}.webp`;

    try {
      if (els.btnPartnerBlogCoverUpload) {
        els.btnPartnerBlogCoverUpload.disabled = true;
        els.btnPartnerBlogCoverUpload.textContent = 'Uploading…';
      }

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

      const { error } = await state.sb.storage.from('poi-photos').upload(fileName, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp',
      });
      if (error) throw error;

      const { data } = state.sb.storage.from('poi-photos').getPublicUrl(fileName);
      const url = String(data?.publicUrl || '').trim();
      if (els.partnerBlogFormCoverUrl) {
        els.partnerBlogFormCoverUrl.value = url;
      }
      setPartnerBlogCoverPreview(url);
      showToast('Cover uploaded', 'success');
    } catch (error) {
      console.error('[partner-blog] Cover upload failed:', error);
      showToast(error?.message || 'Failed to upload cover image', 'error');
    } finally {
      if (els.btnPartnerBlogCoverUpload) {
        els.btnPartnerBlogCoverUpload.disabled = false;
        els.btnPartnerBlogCoverUpload.textContent = 'Upload cover';
      }
      if (els.partnerBlogFormCoverFile) {
        els.partnerBlogFormCoverFile.value = '';
      }
    }
  }

  function collectPartnerBlogTranslations() {
    return PARTNER_BLOG_LANGUAGES.reduce((accumulator, lang) => {
      const editorValue = getPartnerBlogEditorValue(lang.code);
      const title = getPartnerBlogTranslationValue('title', lang.code);
      const lead = getPartnerBlogTranslationValue('lead', lang.code);
      const summary = firstSentenceText(lead) || title;
      accumulator[lang.code] = {
        slug: slugifyText(getPartnerBlogTranslationValue('slug', lang.code)),
        title,
        lead,
        summary,
        meta_title: title,
        meta_description: firstSentenceText(lead) || summary || title,
        content_json: editorValue.content_json,
        content_html: editorValue.content_html,
      };
      return accumulator;
    }, {});
  }

  function validatePartnerBlogTranslations(translations) {
    PARTNER_BLOG_LANGUAGES.forEach((lang) => {
      const current = translations?.[lang.code] || {};
      if (!current.title) throw new Error(`Title (${lang.code.toUpperCase()}) is required.`);
      if (!current.slug) throw new Error(`Slug (${lang.code.toUpperCase()}) is required.`);
      if (!current.meta_description) throw new Error(`Lead (${lang.code.toUpperCase()}) is required to build the meta description.`);
      if (!String(current.content_html || '').trim()) throw new Error(`Content (${lang.code.toUpperCase()}) is required.`);
    });
  }

  function populatePartnerBlogForm(post = null) {
    if (els.partnerBlogFormId) els.partnerBlogFormId.value = post?.id || '';
    if (els.partnerBlogFormStatus) els.partnerBlogFormStatus.value = post?.status === 'archived' ? 'archived' : 'draft';
    if (els.partnerBlogFormCoverUrl) els.partnerBlogFormCoverUrl.value = post?.cover_image_url || '';
    PARTNER_BLOG_TAXONOMY_LANGUAGES.forEach((lang) => {
      const categoryRefs = getPartnerBlogTaxonomyRefs('categories', lang);
      const tagRefs = getPartnerBlogTaxonomyRefs('tags', lang);
      if (categoryRefs.input) categoryRefs.input.value = getPartnerBlogTaxonomyValuesFromPost(post, 'categories', lang).join(', ');
      if (tagRefs.input) tagRefs.input.value = getPartnerBlogTaxonomyValuesFromPost(post, 'tags', lang).join(', ');
    });
    setPartnerBlogCoverPreview(post?.cover_image_url || '');

    const translations = createPartnerBlogTranslations(post?.translations || null);
    PARTNER_BLOG_LANGUAGES.forEach((lang) => {
      setPartnerBlogTranslationField('title', lang.code, translations[lang.code].title);
      setPartnerBlogTranslationField('slug', lang.code, translations[lang.code].slug);
      setPartnerBlogTranslationField('lead', lang.code, translations[lang.code].lead);
      setPartnerBlogTranslationField('content_html', lang.code, translations[lang.code].content_html);
      state.partnerBlog.slugDirtyByLang[lang.code] = Boolean(translations[lang.code].slug);
    });

    PARTNER_BLOG_TAXONOMY_LANGUAGES.forEach((lang) => {
      renderPartnerBlogTaxonomyPicker('categories', lang);
      renderPartnerBlogTaxonomyPicker('tags', lang);
    });
    renderPartnerBlogCtaRows(post?.cta_services || []);
    return translations;
  }

  function resetPartnerBlogForm() {
    els.partnerBlogForm?.reset();
    destroyPartnerBlogEditors();
    resetPartnerBlogDirtyState();
    state.partnerBlog.pendingAction = 'save';
    state.partnerBlog.activeLang = 'pl';
    if (els.partnerBlogFormId) els.partnerBlogFormId.value = '';
    PARTNER_BLOG_TAXONOMY_LANGUAGES.forEach((lang) => {
      const categoryRefs = getPartnerBlogTaxonomyRefs('categories', lang);
      const tagRefs = getPartnerBlogTaxonomyRefs('tags', lang);
      if (categoryRefs.input) categoryRefs.input.value = '';
      if (tagRefs.input) tagRefs.input.value = '';
    });
    if (els.partnerBlogFormCtaRows) els.partnerBlogFormCtaRows.innerHTML = '';
    if (els.btnPartnerBlogDelete) els.btnPartnerBlogDelete.hidden = true;
    PARTNER_BLOG_TAXONOMY_LANGUAGES.forEach((lang) => {
      setPartnerBlogTaxonomyValues('categories', lang, []);
      setPartnerBlogTaxonomyValues('tags', lang, []);
    });
    renderPartnerBlogCtaRows([]);
    setPartnerBlogCoverPreview('');
    switchPartnerBlogLanguage('pl');
  }

  function openPartnerBlogModal(postId = '') {
    ensurePartnerBlogModalPortal();
    const post = postId ? (state.partnerBlog.items || []).find((entry) => entry.id === postId) || null : null;
    if (els.partnerBlogModalTitle) {
      els.partnerBlogModalTitle.textContent = post ? 'Edit partner blog post' : 'Create partner blog post';
    }
    if (els.btnPartnerBlogDelete) {
      els.btnPartnerBlogDelete.hidden = !post || !partnerBlogCanEdit(post);
    }
    resetPartnerBlogDirtyState();
    const translations = populatePartnerBlogForm(post);
    if (els.partnerBlogModal) {
      els.partnerBlogModal.hidden = false;
    }
    document.body.classList.add('partner-blog-modal-open');
    closeSidebar();
    switchPartnerBlogLanguage('pl');
    void initializePartnerBlogEditors(translations);
  }

  function closePartnerBlogModal() {
    if (els.partnerBlogModal) {
      els.partnerBlogModal.hidden = true;
    }
    document.body.classList.remove('partner-blog-modal-open');
    resetPartnerBlogForm();
  }

  function renderPartnerBlogKpis() {
    const rows = Array.isArray(state.partnerBlog.items) ? state.partnerBlog.items : [];
    setText(els.partnerBlogStatTotal, String(rows.length));
    setText(els.partnerBlogStatDraft, String(rows.filter((row) => String(row.status || '') === 'draft').length));
    setText(els.partnerBlogStatPending, String(rows.filter((row) => String(row.submission_status || '') === 'pending').length));
    setText(els.partnerBlogStatApproved, String(rows.filter((row) => String(row.submission_status || '') === 'approved').length));
  }

  function filteredPartnerBlogItems() {
    const search = String(state.partnerBlog.filterSearch || '').trim().toLowerCase();
    const status = String(state.partnerBlog.filterStatus || '').trim().toLowerCase();
    return (state.partnerBlog.items || []).filter((post) => {
      if (status) {
        const statusMatch = String(post.status || '').toLowerCase() === status || String(post.submission_status || '').toLowerCase() === status;
        if (!statusMatch) return false;
      }
      if (!search) return true;
      const en = getPartnerBlogDisplayTranslation(post, 'en');
      const pl = getPartnerBlogDisplayTranslation(post, 'pl');
      const haystack = [
        post.id,
        post.status,
        post.submission_status,
        (post.categories || []).join(' '),
        (post.tags || []).join(' '),
        en.title,
        en.slug,
        pl.title,
        pl.slug,
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }

  function renderPartnerBlogTable() {
    if (!els.partnerBlogTableBody) return;
    const rows = filteredPartnerBlogItems();
    if (!rows.length) {
      els.partnerBlogTableBody.innerHTML = '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">No blog posts found for this partner.</td></tr>';
      return;
    }

    els.partnerBlogTableBody.innerHTML = rows.map((post) => {
      const en = getPartnerBlogDisplayTranslation(post, 'en');
      const pl = getPartnerBlogDisplayTranslation(post, 'pl');
      const title = en.title || pl.title || 'Untitled';
      const slug = en.slug || pl.slug || '—';
      const editable = partnerBlogCanEdit(post);
      return `
        <tr>
          <td data-label="Title">
            <strong>${escapeHtml(title)}</strong>
            <div class="partner-blog-meta-line">${escapeHtml(slug)}</div>
          </td>
          <td data-label="Status">${partnerBlogBadgeHtml(post.status)}</td>
          <td data-label="Review">${partnerBlogBadgeHtml(post.submission_status, 'submission')}</td>
          <td data-label="Created">${escapeHtml(formatDateTime(post.created_at))}</td>
          <td data-label="Actions" style="text-align:right;">
            <div class="btn-row" style="justify-content:flex-end;">
              ${editable ? `<button class="btn-sm" type="button" data-partner-blog-edit="${escapeHtml(post.id)}">Edit</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadPartnerBlogPosts() {
    if (!state.sb || !state.selectedPartnerId) return [];
    const { data, error } = await executePartnerBlogTaxonomyFallback(
      () => state.sb
        .from('blog_posts')
        .select(PARTNER_BLOG_TABLE_SELECT)
        .eq('owner_partner_id', state.selectedPartnerId)
        .order('updated_at', { ascending: false })
        .limit(200),
      () => state.sb
        .from('blog_posts')
        .select(PARTNER_BLOG_TABLE_SELECT_LEGACY)
        .eq('owner_partner_id', state.selectedPartnerId)
        .order('updated_at', { ascending: false })
        .limit(200)
    );
    if (error) throw error;
    state.partnerBlog.items = Array.isArray(data) ? data.map(normalizePartnerBlogRow) : [];
    collectPartnerBlogTaxonomySuggestions();
    renderPartnerBlogKpis();
    renderPartnerBlogTable();
    return state.partnerBlog.items;
  }

  async function refreshPartnerBlogView() {
    const partner = getPartnerBlogCurrentPartner();
    if (!partner?.can_manage_blog) {
      setHidden(els.partnerBlogView, true);
      return;
    }
    state.partnerBlog.resourcesByType = {};
    if (els.partnerBlogCurrentPartner) {
      els.partnerBlogCurrentPartner.textContent = partner?.name ? `Blog for ${partner.name}` : 'Partner blog';
    }
    if (els.partnerBlogStatusHint) {
      els.partnerBlogStatusHint.textContent = 'Posts stay private until approved and published by admin.';
    }
    if (els.partnerBlogTableBody) {
      els.partnerBlogTableBody.innerHTML = '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">Loading…</td></tr>';
    }
    try {
      await loadPartnerBlogPosts();
    } catch (error) {
      console.error('[partner-blog] Failed to load posts:', error);
      if (els.partnerBlogTableBody) {
        els.partnerBlogTableBody.innerHTML = `<tr><td colspan="5" class="muted" style="padding: 16px 8px;">Error: ${escapeHtml(error?.message || 'Failed to load posts')}</td></tr>`;
      }
      showToast(error?.message || 'Failed to load partner blog posts', 'error');
    }
  }

  async function savePartnerBlogForm(event) {
    event.preventDefault();
    if (!state.sb || !state.selectedPartnerId) {
      showToast('Select partner first.', 'error');
      return;
    }

    const action = String(state.partnerBlog.pendingAction || 'save').trim() || 'save';
    state.partnerBlog.pendingAction = 'save';
    const editingId = String(els.partnerBlogFormId?.value || '').trim();
    const existingPost = editingId ? (state.partnerBlog.items || []).find((entry) => entry.id === editingId) || null : null;
    const translations = collectPartnerBlogTranslations();

    try {
      validatePartnerBlogTranslations(translations);

      const statusValue = String(els.partnerBlogFormStatus?.value || 'draft').trim();
      const status = statusValue === 'archived' ? 'archived' : 'draft';
      const submissionStatus = action === 'submit'
        ? 'pending'
        : action === 'draft'
          ? 'draft'
          : (existingPost?.submission_status === 'pending' ? 'pending' : 'draft');
      const currentUserId = String(state.user?.id || '').trim() || null;

      const payload = {
        status,
        submission_status: submissionStatus,
        published_at: null,
        cover_image_url: String(els.partnerBlogFormCoverUrl?.value || '').trim() || null,
        cover_image_alt: {},
        featured: false,
        allow_comments: false,
        categories: Array.from(new Set([
          ...getPartnerBlogTaxonomyValues('categories', 'pl'),
          ...getPartnerBlogTaxonomyValues('categories', 'en'),
        ])),
        categories_pl: getPartnerBlogTaxonomyValues('categories', 'pl'),
        categories_en: getPartnerBlogTaxonomyValues('categories', 'en'),
        tags: Array.from(new Set([
          ...getPartnerBlogTaxonomyValues('tags', 'pl'),
          ...getPartnerBlogTaxonomyValues('tags', 'en'),
        ])),
        tags_pl: getPartnerBlogTaxonomyValues('tags', 'pl'),
        tags_en: getPartnerBlogTaxonomyValues('tags', 'en'),
        cta_services: collectPartnerBlogCtaRows(),
        author_profile_id: null,
        owner_partner_id: state.selectedPartnerId,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        updated_by: currentUserId,
      };

      let blogPostId = editingId;
      if (editingId) {
        let updateResult = await state.sb.from('blog_posts').update(payload).eq('id', editingId).eq('owner_partner_id', state.selectedPartnerId);
        if (updateResult.error && isMissingPartnerBlogTaxonomySchemaError(updateResult.error)) {
          updateResult = await state.sb
            .from('blog_posts')
            .update(stripPartnerBlogTaxonomyPayload(payload))
            .eq('id', editingId)
            .eq('owner_partner_id', state.selectedPartnerId);
        }
        const { error } = updateResult;
        if (error) throw error;
      } else {
        let insertResult = await state.sb
          .from('blog_posts')
          .insert({
            ...payload,
            created_by: currentUserId,
          })
          .select('id')
          .single();
        if (insertResult.error && isMissingPartnerBlogTaxonomySchemaError(insertResult.error)) {
          insertResult = await state.sb
            .from('blog_posts')
            .insert({
              ...stripPartnerBlogTaxonomyPayload(payload),
              created_by: currentUserId,
            })
            .select('id')
            .single();
        }
        const { data, error } = insertResult;
        if (error) throw error;
        blogPostId = data?.id || '';
      }

      const translationPayloads = PARTNER_BLOG_LANGUAGES.map((lang) => ({
        blog_post_id: blogPostId,
        lang: lang.code,
        slug: translations[lang.code].slug,
        title: translations[lang.code].title,
        meta_title: translations[lang.code].meta_title,
        meta_description: translations[lang.code].meta_description,
        summary: translations[lang.code].summary,
        lead: translations[lang.code].lead || null,
        author_name: null,
        author_url: null,
        content_json: translations[lang.code].content_json,
        content_html: translations[lang.code].content_html,
        og_image_url: null,
      }));

      const { error: translationError } = await state.sb
        .from('blog_post_translations')
        .upsert(translationPayloads, { onConflict: 'blog_post_id,lang' });
      if (translationError) throw translationError;

      showToast(action === 'submit' ? 'Post sent for approval' : (editingId ? 'Draft updated' : 'Draft created'), 'success');
      closePartnerBlogModal();
      await refreshPartnerBlogView();
    } catch (error) {
      console.error('[partner-blog] Failed to save post:', error);
      showToast(error?.message || 'Failed to save partner blog post', 'error');
    }
  }

  async function deletePartnerBlogPost(postId = '') {
    const id = String(postId || els.partnerBlogFormId?.value || '').trim();
    if (!id) return;
    if (!window.confirm('Delete this blog post?')) return;
    try {
      const { error } = await state.sb.from('blog_posts').delete().eq('id', id).eq('owner_partner_id', state.selectedPartnerId);
      if (error) throw error;
      showToast('Blog post deleted', 'success');
      closePartnerBlogModal();
      await refreshPartnerBlogView();
    } catch (error) {
      console.error('[partner-blog] Failed to delete post:', error);
      showToast(error?.message || 'Failed to delete blog post', 'error');
    }
  }

  async function loadPartnerResourceIdsForType(resourceType) {
    if (!state.selectedPartnerId) return [];
    const t = String(resourceType || '').trim();
    if (!t) return [];

    try {
      const { data, error } = await state.sb
        .from('partner_resources')
        .select('resource_id')
        .eq('partner_id', state.selectedPartnerId)
        .eq('resource_type', t)
        .limit(500);

      if (error) throw error;
      return (data || []).map(r => r.resource_id).filter(Boolean);
    } catch (_e) {
      return [];
    }
  }

  function attachPartnerBlogEventListeners() {
    els.partnerBlogSearch?.addEventListener('input', () => {
      state.partnerBlog.filterSearch = String(els.partnerBlogSearch?.value || '').trim();
      renderPartnerBlogTable();
    });

    els.partnerBlogStatusFilter?.addEventListener('change', () => {
      state.partnerBlog.filterStatus = String(els.partnerBlogStatusFilter?.value || '').trim();
      renderPartnerBlogTable();
    });

    els.btnPartnerBlogRefresh?.addEventListener('click', async () => {
      await refreshPartnerBlogView();
    });

    els.btnPartnerBlogNew?.addEventListener('click', () => {
      openPartnerBlogModal();
    });

    els.btnClosePartnerBlogModal?.addEventListener('click', closePartnerBlogModal);
    els.partnerBlogModalOverlay?.addEventListener('click', closePartnerBlogModal);
    els.btnPartnerBlogCancel?.addEventListener('click', closePartnerBlogModal);
    els.btnPartnerBlogDelete?.addEventListener('click', async () => {
      await deletePartnerBlogPost();
    });
    els.btnPartnerBlogSaveDraft?.addEventListener('click', () => {
      queuePartnerBlogAction('draft');
    });
    els.btnPartnerBlogSubmit?.addEventListener('click', () => {
      queuePartnerBlogAction('submit');
    });
    els.btnPartnerBlogSave?.addEventListener('click', () => {
      state.partnerBlog.pendingAction = 'save';
    });
    els.partnerBlogForm?.addEventListener('submit', savePartnerBlogForm);

    els.btnPartnerBlogAddCta?.addEventListener('click', () => {
      partnerBlogAddCtaRow();
    });

    els.btnPartnerBlogCoverUpload?.addEventListener('click', () => {
      els.partnerBlogFormCoverFile?.click();
    });

    els.partnerBlogFormCoverFile?.addEventListener('change', () => {
      void handlePartnerBlogCoverUpload();
    });

    els.partnerBlogFormCoverUrl?.addEventListener('input', (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      setPartnerBlogCoverPreview(target?.value || '');
    });

    els.partnerBlogTableBody?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-partner-blog-edit]') : null;
      if (!target) return;
      const postId = String(target.getAttribute('data-partner-blog-edit') || '').trim();
      if (!postId) return;
      openPartnerBlogModal(postId);
    });

    els.partnerBlogFormCtaRows?.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const removeButton = event.target.closest('[data-partner-blog-cta-remove]');
      if (removeButton instanceof HTMLElement) {
        partnerBlogRemoveCtaRow(Number.parseInt(removeButton.dataset.partnerBlogCtaRemove || '-1', 10));
      }
    });

    els.partnerBlogFormCtaRows?.addEventListener('change', (event) => {
      if (!(event.target instanceof Element)) return;
      const typeSelect = event.target.closest('[data-partner-blog-cta-type]');
      if (!(typeSelect instanceof HTMLSelectElement)) return;
      const row = typeSelect.closest('.partner-blog-cta-row');
      if (!row) return;
      void populatePartnerBlogResourceOptions(row, typeSelect.value, '');
    });

    els.partnerBlogForm?.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;

      const langTab = event.target.closest('[data-partner-blog-lang-tab]');
      if (langTab instanceof HTMLElement) {
        switchPartnerBlogLanguage(String(langTab.dataset.partnerBlogLangTab || 'pl').trim());
        return;
      }

      const copyButton = event.target.closest('[data-partner-blog-copy]');
      if (copyButton instanceof HTMLElement) {
        copyPartnerBlogTranslation(
          String(copyButton.dataset.partnerBlogCopy || 'pl').trim(),
          String(copyButton.dataset.partnerBlogCopySource || 'en').trim(),
        );
        return;
      }

      const removeChip = event.target.closest('[data-partner-blog-taxonomy-remove]');
      if (removeChip instanceof HTMLElement) {
        removePartnerBlogTaxonomyValue(
          String(removeChip.dataset.partnerBlogTaxonomyRemove || '').trim(),
          String(removeChip.dataset.partnerBlogTaxonomyLang || '').trim() || 'pl',
          String(removeChip.dataset.value || '').trim(),
        );
        return;
      }

      const pickChip = event.target.closest('[data-partner-blog-taxonomy-pick]');
      if (pickChip instanceof HTMLElement) {
        addPartnerBlogTaxonomyValue(
          String(pickChip.dataset.partnerBlogTaxonomyPick || '').trim(),
          String(pickChip.dataset.partnerBlogTaxonomyLang || '').trim() || 'pl',
          String(pickChip.dataset.value || '').trim(),
        );
        return;
      }

      const addTaxonomy = event.target.closest('[data-partner-blog-taxonomy-add]');
      if (addTaxonomy instanceof HTMLElement) {
        const kind = String(addTaxonomy.dataset.partnerBlogTaxonomyAdd || '').trim();
        const lang = String(addTaxonomy.dataset.partnerBlogTaxonomyLang || '').trim() || 'pl';
        const refs = getPartnerBlogTaxonomyRefs(kind, lang);
        addPartnerBlogTaxonomyValue(kind, lang, refs.composer?.value || '');
        return;
      }

      const toolbarButton = event.target.closest('[data-partner-blog-editor-action]');
      if (toolbarButton instanceof HTMLElement) {
        runPartnerBlogEditorCommand(
          String(toolbarButton.dataset.lang || 'pl').trim(),
          String(toolbarButton.dataset.partnerBlogEditorAction || '').trim(),
        );
      }
    });

    els.partnerBlogForm?.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.matches('[data-partner-blog-field][data-lang]')) {
        const lang = String(target.getAttribute('data-lang') || '').trim();
        const field = String(target.getAttribute('data-partner-blog-field') || '').trim();
        if (!lang || !field) return;

        if (field === 'slug' && target instanceof HTMLInputElement) {
          target.value = slugifyText(target.value || '');
          state.partnerBlog.slugDirtyByLang[lang] = Boolean(String(target.value || '').trim());
        }

        if (field !== 'slug') {
          state.partnerBlog.dirtyByLang[lang][field] = true;
        } else {
          state.partnerBlog.dirtyByLang[lang].slug = true;
        }

        if (field === 'title') {
          partnerBlogApplySmartDefaults(lang, 'title');
        } else if (field === 'lead') {
          partnerBlogApplySmartDefaults(lang, 'lead');
        }
        return;
      }

      if (target.matches('[data-partner-blog-editor-fallback]')) {
        const lang = String(target.getAttribute('data-partner-blog-editor-fallback') || '').trim();
        if (lang && state.partnerBlog.dirtyByLang[lang]) {
          state.partnerBlog.dirtyByLang[lang].content_html = true;
        }
        return;
      }

      if (target === els.partnerBlogFormCoverUrl) {
        setPartnerBlogCoverPreview(String((target instanceof HTMLInputElement ? target.value : '') || '').trim());
      }
    });

    els.partnerBlogForm?.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const match = target.id.match(/^partnerBlogForm(Categories|Tags)(Pl|En)Input$/);
      if (!match) return;
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const kind = match[1] === 'Categories' ? 'categories' : 'tags';
        const lang = match[2] === 'Pl' ? 'pl' : 'en';
        addPartnerBlogTaxonomyValue(kind, lang, (target instanceof HTMLInputElement ? target.value : ''));
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (els.partnerBlogModal?.hidden) return;
      closePartnerBlogModal();
    });
  }

  function normalizeCarLocation(value) {
    const v = value == null ? '' : String(value).trim().toLowerCase();
    if (!v) return null;
    if (v === 'paphos' || v === 'larnaca') return v;
    if (v === 'airport_pfo' || v === 'pfo' || v === 'paphos_airport') return 'paphos';
    if (v === 'airport_lca' || v === 'lca' || v === 'larnaca_airport') return 'larnaca';
    return null;
  }

  function carLocationFromFulfillmentDetails(details) {
    if (!details || typeof details !== 'object') return null;
    return normalizeCarLocation(details.pickup_location || details.pickupLocation || details.location);
  }

  function blockResourceIdsForType(resourceType) {
    const t = String(resourceType || '').trim();
    if (!t) return [];
    const ids = new Set();
    (state.blocks || []).forEach((b) => {
      if (!b) return;
      if (String(b.resource_type || '') !== t) return;
      if (!b.resource_id) return;
      ids.add(String(b.resource_id));
    });
    return Array.from(ids);
  }

  function fallbackLabelForResource(type, id) {
    const prefix = String(id || '').slice(0, 8);
    if (type === 'cars') return `Car (${prefix})`;
    if (type === 'trips') return `Trip (${prefix})`;
    if (type === 'hotels') return `Hotel (${prefix})`;
    if (type === 'transport') return `Transport (${prefix})`;
    if (type === 'shop') return `Shop (${prefix})`;
    return `Resource (${prefix})`;
  }

  async function loadCalendarResourcesForType(resourceType) {
    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const type = String(resourceType || '').trim();
    if (!partner || !type) return [];

    if (type === 'shop') {
      const vendorId = partner.shop_vendor_id;
      const rows = vendorId ? [{ id: vendorId, label: 'All shop products (vendor)' }] : [];
      try {
        if (vendorId) {
          const { data, error } = await state.sb
            .from('shop_products')
            .select('id, name, slug, status')
            .eq('vendor_id', vendorId)
            .order('updated_at', { ascending: false })
            .limit(500);

          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            rows.push({ id: r.id, label: r.name || r.slug || r.id });
          });
        }
      } catch (_e) {
      }

      const fromBlocks = blockResourceIdsForType('shop');
      fromBlocks.forEach((id) => {
        if (!id) return;
        if (!rows.some(r => String(r.id) === String(id))) rows.push({ id, label: fallbackLabelForResource('shop', id) });
      });

      return rows;
    }

    if (type === 'cars') {
      const assignedIds = await loadPartnerResourceIdsForType('cars');
      const rowsMap = new Map();
      const locs = Array.isArray(partner.cars_locations) ? partner.cars_locations.filter(Boolean) : [];

      try {
        let q = state.sb
          .from('car_offers')
          .select('id, car_model, car_type, location')
          .eq('owner_partner_id', partner.id);
        if (locs.length) q = q.in('location', locs);
        const { data, error } = await q.order('updated_at', { ascending: false }).limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const label = `${normalizeTitleJson(r.car_model) || normalizeTitleJson(r.car_type) || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
          rowsMap.set(r.id, { id: r.id, label });
        });
      } catch (_e) {}

      if (assignedIds.length) {
        try {
          let q = state.sb
            .from('car_offers')
            .select('id, car_model, car_type, location')
            .in('id', assignedIds);
          if (locs.length) q = q.in('location', locs);
          const { data, error } = await q.order('updated_at', { ascending: false }).limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const label = `${normalizeTitleJson(r.car_model) || normalizeTitleJson(r.car_type) || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
            rowsMap.set(r.id, { id: r.id, label });
          });
        } catch (_e) {
          assignedIds.forEach((id) => {
            if (!id) return;
            if (!rowsMap.has(id)) rowsMap.set(id, { id, label: `Car (${String(id).slice(0, 8)})` });
          });
        }
      }

      const fromBlocks = blockResourceIdsForType('cars');
      fromBlocks.forEach((id) => {
        if (!id) return;
        if (!rowsMap.has(id)) rowsMap.set(id, { id, label: fallbackLabelForResource('cars', id) });
      });

      if (!rowsMap.size) {
        try {
          let q = state.sb
            .from('car_offers')
            .select('id, car_model, car_type, location')
            .eq('is_published', true);
          if (locs.length) q = q.in('location', locs);
          const { data, error } = await q.order('updated_at', { ascending: false }).limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const label = `${normalizeTitleJson(r.car_model) || normalizeTitleJson(r.car_type) || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
            rowsMap.set(r.id, { id: r.id, label });
          });
        } catch (e) {
          try {
            const msg = String(e?.message || '');
            if (!/is_published/i.test(msg)) throw e;
            let q = state.sb
              .from('car_offers')
              .select('id, car_model, car_type, location');
            if (locs.length) q = q.in('location', locs);
            const { data, error } = await q.order('updated_at', { ascending: false }).limit(500);
            if (error) throw error;
            (data || []).forEach((r) => {
              if (!r?.id) return;
              const label = `${normalizeTitleJson(r.car_model) || normalizeTitleJson(r.car_type) || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
              rowsMap.set(r.id, { id: r.id, label });
            });
          } catch (_e2) {}
        }
      }

      return Array.from(rowsMap.values());
    }

    if (type === 'trips') {
      const assignedIds = await loadPartnerResourceIdsForType('trips');
      const rowsMap = new Map();

      async function selectTrips(opts) {
        const ownerId = opts?.ownerId || null;
        const ids = Array.isArray(opts?.ids) ? opts.ids.filter(Boolean) : [];
        const limit = Number(opts?.limit || 500);

        const attempts = [
          { select: 'id, slug, title, start_city', order: 'updated_at' },
          { select: 'id, slug, title, start_city', order: 'created_at' },
          { select: 'id, slug, title', order: 'updated_at' },
          { select: 'id, slug, title', order: 'created_at' },
        ];

        let lastError = null;
        for (const attempt of attempts) {
          try {
            let q = state.sb
              .from('trips')
              .select(attempt.select)
              .order(attempt.order, { ascending: false })
              .limit(limit);
            if (ownerId) q = q.eq('owner_partner_id', ownerId);
            if (ids.length) q = q.in('id', ids);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
          } catch (e) {
            lastError = e;
          }
        }
        if (lastError) throw lastError;
        return [];
      }

      if (!assignedIds.length) {
        try {
          const data = await selectTrips({ ownerId: partner.id });
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const title = normalizeTitleJson(r.title) || r.slug || r.id;
            const city = r.start_city ? ` — ${r.start_city}` : '';
            rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
          });
        } catch (_e) {}
      }

      if (assignedIds.length) {
        try {
          const data = await selectTrips({ ids: assignedIds });
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const title = normalizeTitleJson(r.title) || r.slug || r.id;
            const city = r.start_city ? ` — ${r.start_city}` : '';
            rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
          });
        } catch (_e) {
          assignedIds.forEach((id) => {
            if (!id) return;
            if (!rowsMap.has(id)) rowsMap.set(id, { id, label: `Trip (${String(id).slice(0, 8)})` });
          });
        }
      }

      const fromBlocks = blockResourceIdsForType('trips');
      fromBlocks.forEach((id) => {
        if (!id) return;
        if (!rowsMap.has(id)) rowsMap.set(id, { id, label: fallbackLabelForResource('trips', id) });
      });

      return Array.from(rowsMap.values());
    }

    if (type === 'hotels') {
      const assignedIds = await loadPartnerResourceIdsForType('hotels');
      const rowsMap = new Map();

      try {
        const { data, error } = await state.sb
          .from('hotels')
          .select('id, slug, title, city')
          .eq('owner_partner_id', partner.id)
          .order('updated_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const title = normalizeTitleJson(r.title) || r.slug || r.id;
          const city = r.city ? ` — ${r.city}` : '';
          rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
        });
      } catch (_e) {}

      if (assignedIds.length) {
        try {
          const { data, error } = await state.sb
            .from('hotels')
            .select('id, slug, title, city')
            .in('id', assignedIds)
            .order('updated_at', { ascending: false })
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const title = normalizeTitleJson(r.title) || r.slug || r.id;
            const city = r.city ? ` — ${r.city}` : '';
            rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
          });
        } catch (_e) {
          assignedIds.forEach((id) => {
            if (!id) return;
            if (!rowsMap.has(id)) rowsMap.set(id, { id, label: `Hotel (${String(id).slice(0, 8)})` });
          });
        }
      }

      const fromBlocks = blockResourceIdsForType('hotels');
      fromBlocks.forEach((id) => {
        if (!id) return;
        if (!rowsMap.has(id)) rowsMap.set(id, { id, label: fallbackLabelForResource('hotels', id) });
      });

      return Array.from(rowsMap.values());
    }

    if (type === 'transport') {
      const assignedIds = await loadPartnerResourceIdsForType('transport');
      const rowsMap = new Map();

      const appendTransportRoutes = async (ids) => {
        const routeIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!routeIds.length) return;

        const { data: routes, error: routesError } = await state.sb
          .from('transport_routes')
          .select('id, origin_location_id, destination_location_id')
          .in('id', routeIds)
          .limit(1000);
        if (routesError) throw routesError;

        const routeRows = Array.isArray(routes) ? routes : [];
        const locationIds = Array.from(new Set(routeRows.flatMap((r) => [r?.origin_location_id, r?.destination_location_id]).filter(Boolean)));
        const locationById = {};

        if (locationIds.length) {
          try {
            const { data: locations, error: locationsError } = await state.sb
              .from('transport_locations')
              .select('id, name, code')
              .in('id', locationIds)
              .limit(1000);
            if (locationsError) throw locationsError;
            (locations || []).forEach((loc) => {
              if (!loc?.id) return;
              locationById[loc.id] = loc;
            });
          } catch (_e) {
          }
        }

        routeRows.forEach((route) => {
          if (!route?.id) return;
          const origin = locationById[route.origin_location_id] || null;
          const destination = locationById[route.destination_location_id] || null;
          const originLabel = String(origin?.name || route.origin_location_id || '').trim() || String(route.id).slice(0, 8);
          const destinationLabel = String(destination?.name || route.destination_location_id || '').trim() || String(route.id).slice(0, 8);
          rowsMap.set(route.id, { id: route.id, label: `${originLabel} → ${destinationLabel}` });
        });
      };

      if (assignedIds.length) {
        try {
          await appendTransportRoutes(assignedIds);
        } catch (_e) {
          assignedIds.forEach((id) => {
            if (!id) return;
            if (!rowsMap.has(id)) rowsMap.set(id, { id, label: fallbackLabelForResource('transport', id) });
          });
        }
      }

      if (!rowsMap.size) {
        try {
          const { data, error } = await state.sb
            .from('partner_service_fulfillments')
            .select('resource_id')
            .eq('partner_id', state.selectedPartnerId)
            .eq('resource_type', 'transport')
            .not('resource_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(500);
          if (error) throw error;
          const routeIdsFromFulfillments = Array.from(new Set((data || []).map((r) => String(r?.resource_id || '').trim()).filter(Boolean)));
          if (routeIdsFromFulfillments.length) {
            await appendTransportRoutes(routeIdsFromFulfillments);
          }
        } catch (_e) {
        }
      }

      const fromBlocks = blockResourceIdsForType('transport');
      fromBlocks.forEach((id) => {
        if (!id) return;
        if (!rowsMap.has(id)) rowsMap.set(id, { id, label: fallbackLabelForResource('transport', id) });
      });

      return Array.from(rowsMap.values());
    }

    return [];
  }

  async function loadCalendarResourceOptions() {
    const type = String(els.blockResourceType?.value || '').trim();
    const select = els.blockResourceId;
    if (!select) return;

    if (!type) {
      setHtml(select, '<option value="">Select resource</option>');
      return;
    }

    try {
      const rows = await loadCalendarResourcesForType(type);
      state.calendar.resourcesByType[type] = rows;

      const existing = select.value;
      const options = ['<option value="">Select resource</option>']
        .concat(rows.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`));
      setHtml(select, options.join(''));

      if (existing && rows.some(r => String(r.id) === String(existing))) {
        select.value = existing;
        return;
      }

      const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
      if (type === 'shop' && partner?.shop_vendor_id && rows.some(r => String(r.id) === String(partner.shop_vendor_id))) {
        select.value = partner.shop_vendor_id;
        return;
      }

      if (rows.length) {
        select.value = rows[0].id;
      }

      if (state.availability.bulkMode && type && select.value) {
        ensureSelectedSetForType(type).add(String(select.value));
      }

      renderResourcePanels();
      updateAvailabilitySelectionSummary();
    } catch (error) {
      console.error(error);
      setHtml(select, '<option value="">Select resource</option>');
    }
  }

  function renderResourceTypePanels() {
    if (!els.resourceTypePanels || !els.blockResourceType) return;

    const options = Array.from(els.blockResourceType.options || []).map((o) => {
      return { value: String(o.value || '').trim(), label: String(o.textContent || o.value || '').trim() };
    }).filter((o) => o.value);

    const current = String(els.blockResourceType.value || '').trim();

    const html = options.map((o) => {
      const active = o.value === current;
      const bg = active ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)';
      const border = active ? 'rgba(59,130,246,0.65)' : 'rgba(255,255,255,0.14)';
      return `<button type="button" data-rt="${escapeHtml(o.value)}" style="padding: 8px 10px; border-radius: 10px; border: 1px solid ${border}; background:${bg}; color: inherit; cursor:pointer; font-weight: 600;">${escapeHtml(labelForResourceType(o.value))}</button>`;
    }).join('');

    setHtml(els.resourceTypePanels, html || '<div class="muted small">No resource types.</div>');

    els.resourceTypePanels.querySelectorAll('button[data-rt]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const next = btn.getAttribute('data-rt') || '';
        if (!next) return;
        if (String(els.blockResourceType.value || '') === next) return;
        els.blockResourceType.value = next;

        await loadBlocks();
        syncResourceTypeOptions();
        renderResourceTypePanels();
        await loadCalendarResourceOptions();
        await loadCalendarMonthData();
      });
    });
  }

  function renderResourcePanels() {
    if (!els.resourcePanels || !els.blockResourceType || !els.blockResourceId) return;
    const type = String(els.blockResourceType.value || '').trim();
    const rows = state.calendar.resourcesByType?.[type] || [];
    const current = String(els.blockResourceId.value || '').trim();

    const bulk = Boolean(state.availability.bulkMode);
    const selectedSet = bulk ? ensureSelectedSetForType(type) : null;

    const html = (rows || []).map((r) => {
      const id = String(r?.id || '').trim();
      if (!id) return '';
      const label = String(r?.label || '').trim() || fallbackLabelForResource(type, id);

      const isCurrent = id === current;
      const isSelected = bulk && selectedSet && selectedSet.has(id);

      const bg = isCurrent
        ? 'rgba(34,197,94,0.18)'
        : (isSelected ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)');
      const border = isCurrent
        ? 'rgba(34,197,94,0.65)'
        : (isSelected ? 'rgba(59,130,246,0.65)' : 'rgba(255,255,255,0.14)');

      const badge = bulk && isSelected
        ? '<div class="muted small" style="margin-top:6px; font-weight:700; color: rgba(59,130,246,0.95);">Selected</div>'
        : (isCurrent ? '<div class="muted small" style="margin-top:6px; font-weight:700; color: rgba(34,197,94,0.95);">Current</div>' : '');

      return `<button type="button" data-rid="${escapeHtml(id)}" style="text-align:left; padding: 10px 10px; border-radius: 12px; border: 1px solid ${border}; background:${bg}; color: inherit; cursor:pointer;">
        <div style="font-weight:700;">${escapeHtml(label)}</div>
        <div class="muted small" style="margin-top:4px;"><code>${escapeHtml(id.slice(0, 8))}</code></div>
        ${badge}
      </button>`;
    }).filter(Boolean).join('');

    setHtml(els.resourcePanels, html || '<div class="muted small" style="padding: 8px 4px;">No resources.</div>');

    els.resourcePanels.querySelectorAll('button[data-rid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rid = btn.getAttribute('data-rid') || '';
        if (!rid) return;

        if (bulk) {
          const set = ensureSelectedSetForType(type);
          if (set.has(rid)) {
            set.delete(rid);
          } else {
            set.add(rid);
          }
          updateAvailabilitySelectionSummary();
        }

        const shouldReload = String(els.blockResourceId.value || '') !== rid;
        if (shouldReload) {
          els.blockResourceId.value = rid;
        }

        renderResourcePanels();
        if (shouldReload) {
          await loadCalendarMonthData();
        }
      });
    });

    updateAvailabilitySelectionSummary();
  }

  function renderBlocksTable() {
    if (!els.blocksBody) return;

    if (!state.blocks.length) {
      setHtml(els.blocksBody, '<tr><td colspan="4" class="muted" style="padding: 16px 8px;">No blocks yet.</td></tr>');
      return;
    }

    const rows = state.blocks
      .map((b) => {
        const note = b.note ? escapeHtml(b.note) : '<span class="muted">—</span>';
        return `
          <tr>
            <td>
              <div><strong>${escapeHtml(b.resource_type)}</strong></div>
              <div class="muted small"><code>${escapeHtml(String(b.resource_id || ''))}</code></div>
            </td>
            <td class="small">${escapeHtml(String(b.start_date))} → ${escapeHtml(String(b.end_date))}</td>
            <td>${note}</td>
            <td style="text-align:right;">
              <button class="btn-action btn-danger" type="button" data-delete-block="${escapeHtml(b.id)}">Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');

    setHtml(els.blocksBody, rows);

    els.blocksBody.querySelectorAll('button[data-delete-block]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const blockId = btn.getAttribute('data-delete-block');
        if (!blockId) return;
        if (!confirm('Delete this availability block?')) return;

        try {
          btn.disabled = true;
          const { error } = await state.sb
            .from('partner_availability_blocks')
            .delete()
            .eq('id', blockId)
            .eq('partner_id', state.selectedPartnerId);

          if (error) throw error;
          showToast('Block deleted', 'success');
          await refreshCalendar();
        } catch (error) {
          console.error(error);
          showToast(`Error: ${error.message || 'Delete failed'}`, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  function syncResourceTypeOptions() {
    const select = els.blockResourceType;
    if (!select) return;

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const canShop = Boolean(partner?.can_manage_shop && partner?.shop_vendor_id);
    const canCars = Boolean(partner?.can_manage_cars);
    const canTrips = Boolean(partner?.can_manage_trips);
    const canHotels = Boolean(partner?.can_manage_hotels);
    const canTransport = Boolean(partner?.can_manage_transport);

    const blockTypes = new Set();
    (state.blocks || []).forEach((b) => {
      if (!b?.resource_type) return;
      blockTypes.add(String(b.resource_type));
    });

    const fulfillmentTypes = new Set();
    (state.fulfillments || []).forEach((f) => {
      const src = String(f?.__source || '');
      if (src === 'shop') {
        fulfillmentTypes.add('shop');
        return;
      }
      const t = String(f?.resource_type || '').trim();
      if (t) fulfillmentTypes.add(t);
    });

    const prev = String(select.value || '').trim();
    const allowed = [];
    if (canShop) allowed.push('shop');
    if (canCars) allowed.push('cars');
    if (canTrips) allowed.push('trips');
    if (canHotels) allowed.push('hotels');
    if (canTransport) allowed.push('transport');

    Array.from(blockTypes).forEach((t) => {
      if (!allowed.includes(t)) allowed.push(t);
    });
    Array.from(fulfillmentTypes).forEach((t) => {
      if (!allowed.includes(t)) allowed.push(t);
    });

    const opts = [];
    if (allowed.includes('shop')) opts.push('<option value="shop">shop</option>');
    if (allowed.includes('cars')) opts.push('<option value="cars">cars</option>');
    if (allowed.includes('trips')) opts.push('<option value="trips">trips</option>');
    if (allowed.includes('hotels')) opts.push('<option value="hotels">hotels</option>');
    if (allowed.includes('transport')) opts.push('<option value="transport">transport</option>');

    setHtml(select, opts.join(''));

    if (prev && allowed.includes(prev)) {
      select.value = prev;
      return;
    }

    if (allowed.length) {
      select.value = allowed[0];
    }
  }

  async function refreshFulfillments() {
    if (!state.selectedPartnerId) return;
    showWarning('');
    setText(els.status, 'Loading fulfillments…');

    try {
      await refreshSelectedPartnerRecord();
      await loadFulfillments();
      syncResourceTypeOptions();
      updateSidebarCategoryVisibility();
      updateAnalyticsCardVisibility();
      updateAffiliateSummaryCardVisibility();
      updateServiceSectionVisibility();
      refreshOrdersPanelViews();
      startAnalyticsRealtime();
      await refreshPortalResponseInsights();
      try {
        await refreshAffiliateSummaryCard();
      } catch (_e) {
      }
      setText(els.status, `Loaded ${state.fulfillments.length} fulfillments.`);
    } catch (error) {
      console.error(error);
      setText(els.status, 'Failed to load fulfillments.');
      showWarning(partnerUserMessage(error, 'Failed to load fulfillments.'));
      showToast(`Error: ${error.message || 'Failed to load fulfillments'}`, 'error');
    }
  }

  async function refreshBlocks() {
    if (!state.selectedPartnerId) return;
    setText(els.status, 'Loading availability…');

    try {
      await loadBlocks();
      renderBlocksTable();
      setText(els.status, `Loaded ${state.blocks.length} blocks.`);
    } catch (error) {
      console.error(error);
      setText(els.status, 'Failed to load availability.');
      showToast(`Error: ${error.message || 'Failed to load availability'}`, 'error');
    }
  }

  async function refreshCalendar() {
    if (!state.selectedPartnerId) return;
    setText(els.status, 'Loading availability…');

    try {
      await loadBlocks();
      renderBlocksTable();

      syncResourceTypeOptions();

      renderResourceTypePanels();

      await loadCalendarResourceOptions();

      const type = String(els.blockResourceType?.value || '').trim();
      const rowsForType = state.calendar.resourcesByType?.[type] || [];
      if (!rowsForType.length) {
        const preferredTypes = ['shop', 'cars', 'trips', 'hotels', 'transport'];
        const allowed = preferredTypes.filter(t => {
          return Array.from(els.blockResourceType?.options || []).some(o => String(o.value) === t);
        });

        for (const t of allowed) {
          const blockIds = blockResourceIdsForType(t);
          if (!blockIds.length) continue;
          els.blockResourceType.value = t;
          await loadCalendarResourceOptions();
          break;
        }
      }

      ensureCalendarMonthInput();
      await loadCalendarMonthData();
      setText(els.status, `Loaded ${state.blocks.length} blocks.`);
    } catch (error) {
      console.error(error);
      setText(els.status, 'Failed to load availability.');
      showToast(`Error: ${error.message || 'Failed to load availability'}`, 'error');
    }
  }

  function setActiveTab(tab) {
    const isFulfillments = tab === 'fulfillments';
    els.tabBtnFulfillments?.classList.toggle('is-active', isFulfillments);
    els.tabBtnCalendar?.classList.toggle('is-active', !isFulfillments);
    setHidden(els.tabFulfillments, !isFulfillments);
    setHidden(els.tabCalendar, isFulfillments);

    updateAnalyticsCardVisibility();
    updateAffiliateSummaryCardVisibility();
    updateServiceSectionVisibility();

    if (isFulfillments && String(state.selectedCategory || 'all') === 'all') {
      try {
        refreshAffiliateSummaryCard();
      } catch (_e) {
      }
    }

    if (isFulfillments) {
      refreshPortalResponseInsights();
      refreshFulfillments();
    } else {
      setHidden(els.partnerPortalResponseCard, true);
      refreshCalendar();
    }
  }

  async function handlePartnerChange(nextPartnerId) {
    state.selectedPartnerId = nextPartnerId || null;
    state.partnerBlog.resourcesByType = {};
    state.partnerBlog.items = [];
    if (state.selectedPartnerId) {
      setPersistedPartnerId(state.selectedPartnerId);
    }
    state.orders.status = 'all';
    state.orders.monthValue = getMonthValue();
    state.orders.selectedDateIso = localDateIso();
    state.orders.dayListVisible = false;
    state.orders.calendarExpanded = false;
    state.orders.filterExpanded = false;

    clearAvailabilitySelectionsAll();
    updateAvailabilitySelectionSummary();

    startBlocksRealtime();
    startAnalyticsRealtime();

    renderSuspendedInfo();

    syncResourceTypeOptions();

    updateSidebarCategoryVisibility();
    updateAffiliateSummaryCardVisibility();
    updateServiceSectionVisibility();
    syncAnalyticsCategoryOptions();

    if (els.partnerBlogModal && !els.partnerBlogModal.hidden) {
      closePartnerBlogModal();
    }
    if (els.partnerLinksPreviewModal && !els.partnerLinksPreviewModal.hidden) {
      closePartnerLinksPreview();
    }

    if (els.partnerProfileView && !els.partnerProfileView.hidden) {
      try {
        renderProfileSettings();
        const payout = await loadPartnerPayoutDetails();
        renderPartnerPayoutDetails(payout);
      } catch (_e) {
      }
    }

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    if (partner && els.blockResourceType && els.blockResourceId) {
      if (els.blockResourceType.value === 'shop' && !els.blockResourceId.value && partner.shop_vendor_id) {
        els.blockResourceId.value = partner.shop_vendor_id;
      }
    }

    if (els.partnerAnalyticsView && !els.partnerAnalyticsView.hidden) {
      await refreshPartnerAnalyticsView({ silent: true });
      return;
    }

    if (els.partnerBlogView && !els.partnerBlogView.hidden) {
      await refreshPartnerBlogView();
      return;
    }

    if (els.partnerReferralsView && !els.partnerReferralsView.hidden) {
      await refreshReferralWidget();
      try {
        await refreshAffiliatePanel();
      } catch (_e) {
      }
      try {
        await refreshReferralOrdersPanel();
      } catch (_e) {
      }
      try {
        await refreshReferralStatsAndTree();
      } catch (_e) {
      }
      return;
    }

    if (els.partnerLinksDiscountsView && !els.partnerLinksDiscountsView.hidden) {
      await refreshPartnerLinksDiscountsView();
      return;
    }

    setActiveTab(els.tabBtnCalendar?.classList.contains('is-active') ? 'calendar' : 'fulfillments');
  }

  async function bootstrapPortal() {
    if (bootstrapInFlight) {
      bootstrapPending = true;
      return;
    }
    bootstrapInFlight = true;

    try {
      showWarning('');

      if (!state.sb) {
        showWarning('Supabase not available.');
        return;
      }

      try {
        await ensureSession();
      } catch (error) {
        console.error(error);
        showWarning('Session error.');

        setMainView('portal');
        setHidden(els.loginPrompt, false);
        setHidden(els.app, true);
        setHidden(els.noPartner, true);
        setText(els.status, 'Not logged in.');
        if (els.partnerUserName) els.partnerUserName.textContent = 'Not logged in';
        setHidden(els.partnerReferralWidget, true);
        return;
      }

      const bootstrapUserId = String(state.user?.id || '').trim();

      if (!state.session || !bootstrapUserId) {
        setMainView('portal');
        setHidden(els.loginPrompt, false);
        setHidden(els.app, true);
        setHidden(els.noPartner, true);
        setText(els.status, 'Not logged in.');
        if (els.partnerUserName) els.partnerUserName.textContent = 'Not logged in';
        setHidden(els.partnerReferralWidget, true);
        setHidden(els.partnerReferralSummary, true);
        // Ensure the login modal is the primary UX entrypoint
        openLogin();
        return;
      }

      if (els.partnerUserName) {
        const name = state.user?.email || state.user?.id || 'Partner';
        els.partnerUserName.textContent = name;
      }

      await loadMyProfile();
      renderProfileSettings();
      await refreshReferralWidget();

      setHidden(els.loginPrompt, true);

      try {
        await loadMemberships(bootstrapUserId);
      } catch (error) {
        console.error(error);
        showWarning(partnerUserMessage(error, 'Failed to load partner.'));
        setHidden(els.app, true);
        setHidden(els.noPartner, true);
        return;
      }

      if (!state.selectedPartnerId) {
        setHidden(els.noPartner, false);
        setHidden(els.app, true);
        setText(els.status, 'No partner membership.');
        return;
      }

      setHidden(els.noPartner, true);
      setHidden(els.app, false);

      renderPartnerSelect();
      renderSuspendedInfo();

      syncResourceTypeOptions();
      updateSidebarCategoryVisibility();
      updateAffiliateSummaryCardVisibility();
      updateServiceSectionVisibility();
      ensureAnalyticsFilterDefaults();
      syncAnalyticsCategoryOptions();
      syncAnalyticsFilterVisibility();
      ensureCalendarMonthInput();

      const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
      if (partner && els.blockResourceType && els.blockResourceId) {
        if (els.blockResourceType.value === 'shop' && !els.blockResourceId.value && partner.shop_vendor_id) {
          els.blockResourceId.value = partner.shop_vendor_id;
        }
      }

      if (els.partnerAnalyticsView && !els.partnerAnalyticsView.hidden) {
        await refreshPartnerAnalyticsView({ silent: true });
      } else {
        setActiveTab('fulfillments');
      }
      setText(els.status, 'Ready.');

      try {
        await refreshAffiliateSummaryCard();
      } catch (_e) {
      }

      try {
        await loadPartnerPushNotificationSettings();
      } catch (_e) {
      }

      if (els.partnerLinksDiscountsView && !els.partnerLinksDiscountsView.hidden) {
        setTimeout(() => {
          if (els.partnerLinksDiscountsView && !els.partnerLinksDiscountsView.hidden) {
            void refreshPartnerLinksDiscountsView();
          }
        }, 0);
      }
    } finally {
      bootstrapInFlight = false;
      if (bootstrapPending) {
        bootstrapPending = false;
        void bootstrapPortal();
      }
    }
  }

  function attachEventListeners() {
    attachPartnerBlogEventListeners();

    els.btnOpenLogin?.addEventListener('click', openLogin);
    els.btnHeaderLogin?.addEventListener('click', openLogin);

    els.partnerDetailsModal?.addEventListener('click', (event) => {
      const closeBtn = event.target instanceof Element
        ? event.target.closest('[data-partner-details-close]')
        : null;
      if (closeBtn) {
        closePartnerDetailsModal({ restoreFocus: true });
        return;
      }
      if (event.target === els.partnerDetailsModal) {
        closePartnerDetailsModal({ restoreFocus: true });
      }
    });

    els.btnPartnerEnablePush?.addEventListener('click', async () => {
      await enablePartnerPushNotifications();
    });

    els.btnPartnerDisablePush?.addEventListener('click', async () => {
      await disablePartnerPushNotifications();
    });

    els.btnRefresh?.addEventListener('click', async () => {
      await bootstrapPortal();
    });

    els.partnerSelect?.addEventListener('change', async () => {
      const nextId = els.partnerSelect.value;
      await handlePartnerChange(nextId);
    });

    els.tabBtnFulfillments?.addEventListener('click', () => setActiveTab('fulfillments'));
    els.tabBtnCalendar?.addEventListener('click', () => setActiveTab('calendar'));

    const applyOrdersStatusFilter = (nextStatus) => {
      state.orders.status = normalizeOrdersStatus(nextStatus);
      state.orders.dayListVisible = false;
      refreshOrdersPanelViews();
    };

    els.btnOrdersFilterToggle?.addEventListener('click', () => {
      state.orders.filterExpanded = !Boolean(state.orders.filterExpanded);
      syncOrdersFilterCollapseUi();
    });

    els.btnOrdersCalendarToggle?.addEventListener('click', () => {
      state.orders.calendarExpanded = !Boolean(state.orders.calendarExpanded);
      syncOrdersCalendarCollapseUi();
    });

    (els.ordersStatusButtons || []).forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = String(btn.getAttribute('data-orders-status-filter') || '').trim();
        applyOrdersStatusFilter(status);
      });
    });

    els.btnOrdersToggleCompact?.addEventListener('click', () => {
      state.orders.compactRows = !Boolean(state.orders.compactRows);
      applyOrdersTableDensity();
      renderFulfillmentsTable(filteredFulfillmentsForOrdersPanel());
    });

    els.btnOrdersClearFilters?.addEventListener('click', () => {
      state.orders.status = 'all';
      state.orders.selectedDateIso = localDateIso();
      state.orders.dayListVisible = false;
      syncOrdersFilterUiFromState();
      refreshOrdersPanelViews();
    });

    els.btnOrdersCalendarPrevMonth?.addEventListener('click', () => {
      ensureOrdersCalendarMonthInput();
      setOrdersCalendarMonthInput(addMonths(state.orders.monthValue || getMonthValue(), -1));
      state.orders.selectedDateIso = '';
      state.orders.dayListVisible = false;
      renderOrdersScheduleCalendar(filteredFulfillmentsForOrdersPanel());
    });

    els.btnOrdersCalendarNextMonth?.addEventListener('click', () => {
      ensureOrdersCalendarMonthInput();
      setOrdersCalendarMonthInput(addMonths(state.orders.monthValue || getMonthValue(), 1));
      state.orders.selectedDateIso = '';
      state.orders.dayListVisible = false;
      renderOrdersScheduleCalendar(filteredFulfillmentsForOrdersPanel());
    });

    els.ordersCalendarMonthInput?.addEventListener('change', () => {
      const mv = String(els.ordersCalendarMonthInput?.value || '').trim();
      if (!mv) {
        setOrdersCalendarMonthInput(getMonthValue());
      } else {
        setOrdersCalendarMonthInput(mv);
      }
      state.orders.selectedDateIso = '';
      state.orders.dayListVisible = false;
      renderOrdersScheduleCalendar(filteredFulfillmentsForOrdersPanel());
    });

    window.addEventListener('hashchange', () => {
      const fid = getFulfillmentFocusIdFromHash();
      if (!fid) return;
      if (!els.tabBtnFulfillments?.classList.contains('is-active')) {
        setActiveTab('fulfillments');
        return;
      }
      focusFulfillmentRowFromHash();
    });

    els.adminMenuToggle?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebar();
    });

    els.adminSidebarOverlay?.addEventListener('click', () => {
      closeSidebar();
    });

    els.partnerNavAll?.addEventListener('click', () => navToCategory('all'));
    els.partnerNavShop?.addEventListener('click', () => navToCategory('shop'));
    els.partnerNavCars?.addEventListener('click', () => navToCategory('cars'));
    els.partnerNavTrips?.addEventListener('click', () => navToCategory('trips'));
    els.partnerNavHotels?.addEventListener('click', () => navToCategory('hotels'));
    els.partnerNavTransport?.addEventListener('click', () => navToCategory('transport'));
    els.partnerNavBlog?.addEventListener('click', () => {
      void navToBlog();
    });
    els.partnerNavCalendar?.addEventListener('click', () => navToCalendar());
    els.partnerNavAnalytics?.addEventListener('click', () => navToAnalytics());
    els.partnerNavProfile?.addEventListener('click', () => navToProfile());
    els.partnerNavReferrals?.addEventListener('click', () => navToReferrals());
    els.partnerNavLinksDiscounts?.addEventListener('click', () => {
      void navToLinksDiscounts();
    });

    els.btnPartnerLinksRefresh?.addEventListener('click', () => {
      void refreshPartnerLinksDiscountsView();
    });
    els.partnerLinksViewTabs?.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-partner-links-view]') : null;
      if (!(button instanceof HTMLElement)) return;
      const next = String(button.getAttribute('data-partner-links-view') || 'services').trim().toLowerCase();
      state.linksDiscounts.view = next === 'discounts' ? 'discounts' : 'services';
      if (state.linksDiscounts.view !== 'services') {
        closePartnerLinksPreview();
      }
      renderPartnerLinksViewTabs();
      syncPartnerLinksViewPanels();
    });
    els.partnerLinksFilters?.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-partner-links-filter]') : null;
      if (!(button instanceof HTMLElement)) return;
      const next = String(button.getAttribute('data-partner-links-filter') || 'all').trim().toLowerCase() || 'all';
      state.linksDiscounts.filter = next;
      ensurePartnerLinksSelectedItem();
      renderPartnerLinksFilters();
      renderPartnerLinksGrid();
      if (!els.partnerLinksPreviewModal?.hidden) {
        renderPartnerLinksPreview();
      }
    });
    els.partnerLinksGrid?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const copyButton = target?.closest('[data-partner-link-copy-url]');
      if (copyButton instanceof HTMLElement) {
        const link = String(copyButton.getAttribute('data-partner-link-copy-url') || '').trim();
        if (!link) {
          showToast('Referral code is unavailable for this account.', 'error');
          return;
        }
        void copyTextToClipboard(link).then((ok) => {
          showToast(ok ? 'Referral link copied' : 'Failed to copy referral link', ok ? 'success' : 'error');
        });
        return;
      }

      const previewTarget = target?.closest('[data-partner-link-preview]');
      if (previewTarget instanceof HTMLElement) {
        const key = String(previewTarget.getAttribute('data-partner-link-preview') || '').trim();
        renderPartnerLinksGrid();
        openPartnerLinksPreview(key);
        return;
      }

      const card = target?.closest('[data-partner-link-card]');
      if (card instanceof HTMLElement) {
        state.linksDiscounts.selectedKey = String(card.getAttribute('data-partner-link-card') || '').trim();
      }
    });
    els.partnerLinksGrid?.addEventListener('keydown', (event) => {
      const stopTarget = event.target instanceof Element ? event.target.closest('[data-partner-link-stop="1"]') : null;
      if (stopTarget) return;
      const target = event.target instanceof Element ? event.target.closest('[data-partner-link-card]') : null;
      if (!(target instanceof HTMLElement)) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const key = String(target.getAttribute('data-partner-link-card') || '').trim();
      if (!key) return;
      renderPartnerLinksGrid();
      openPartnerLinksPreview(key);
    });
    const bindPartnerLinksCopy = (button, input) => {
      button?.addEventListener('click', () => {
        const value = input instanceof HTMLInputElement ? String(input.value || '').trim() : '';
        if (!value) {
          showToast('Referral code is unavailable for this account.', 'error');
          return;
        }
        void copyTextToClipboard(value).then((ok) => {
          showToast(ok ? 'Referral link copied' : 'Failed to copy referral link', ok ? 'success' : 'error');
        });
      });
    };
    bindPartnerLinksCopy(els.btnPartnerLinksCopyLandingPl, els.partnerLinksPreviewLandingLinkPl);
    bindPartnerLinksCopy(els.btnPartnerLinksCopyLandingEn, els.partnerLinksPreviewLandingLinkEn);
    bindPartnerLinksCopy(els.btnPartnerLinksCopyOfferPl, els.partnerLinksPreviewOfferLinkPl);
    bindPartnerLinksCopy(els.btnPartnerLinksCopyOfferEn, els.partnerLinksPreviewOfferLinkEn);
    els.partnerLinksPreviewModalOverlay?.addEventListener('click', () => {
      closePartnerLinksPreview();
    });
    els.btnClosePartnerLinksPreview?.addEventListener('click', () => {
      closePartnerLinksPreview();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (els.partnerLinksPreviewModal?.hidden) return;
      closePartnerLinksPreview();
    });

    const bindPartnerLinksOpen = (button) => {
      button?.addEventListener('click', () => {
        const href = String(button?.dataset?.partnerLinkOpen || '').trim();
        if (!href) return;
        window.open(href, '_blank', 'noopener');
      });
    };
    bindPartnerLinksOpen(els.btnPartnerLinksOpenLanding);
    bindPartnerLinksOpen(els.btnPartnerLinksOpenOffer);

    const handleAnalyticsPeriodChange = async (nextRaw) => {
      const next = String(nextRaw || 'year').trim().toLowerCase() === 'month' ? 'month' : 'year';
      if (state.analytics.period === next) {
        syncAnalyticsFilterVisibility();
        return;
      }
      state.analytics.period = next;
      syncAnalyticsFilterVisibility();
      await refreshPartnerAnalyticsView();
    };

    els.partnerAnalyticsPeriodType?.addEventListener('change', async () => {
      await handleAnalyticsPeriodChange(els.partnerAnalyticsPeriodType?.value);
    });

    els.partnerAnalyticsPeriodYearBtn?.addEventListener('click', async () => {
      await handleAnalyticsPeriodChange('year');
    });

    els.partnerAnalyticsPeriodMonthBtn?.addEventListener('click', async () => {
      await handleAnalyticsPeriodChange('month');
    });

    els.partnerAnalyticsMonth?.addEventListener('change', async () => {
      state.analytics.monthValue = normalizeAnalyticsMonthValue(els.partnerAnalyticsMonth?.value);
      await refreshPartnerAnalyticsView();
    });

    els.partnerAnalyticsYear?.addEventListener('change', async () => {
      state.analytics.yearValue = normalizeAnalyticsYearValue(els.partnerAnalyticsYear?.value);
      await refreshPartnerAnalyticsView();
    });

    els.partnerAnalyticsCategoryFilter?.addEventListener('change', async () => {
      state.analytics.category = String(els.partnerAnalyticsCategoryFilter?.value || 'all').trim().toLowerCase();
      await refreshPartnerAnalyticsView();
    });

    const handleLiveTrendTypeChange = (nextRaw) => {
      const next = normalizeLiveTrendType(nextRaw);
      if (state.analytics.liveTrendType === next) {
        syncLiveTrendControls();
        return;
      }
      state.analytics.liveTrendType = next;
      syncLiveTrendControls();
      rerenderAnalyticsLiveTrendFromCache();
    };

    const handleLiveTrendMetricChange = (nextRaw) => {
      const next = normalizeLiveTrendMetric(nextRaw);
      if (state.analytics.liveTrendMetric === next) {
        syncLiveTrendControls();
        return;
      }
      state.analytics.liveTrendMetric = next;
      syncLiveTrendControls();
      rerenderAnalyticsLiveTrendFromCache();
    };

    els.partnerLiveTrendTypeBarBtn?.addEventListener('click', () => {
      handleLiveTrendTypeChange('bar');
    });

    els.partnerLiveTrendTypeLineBtn?.addEventListener('click', () => {
      handleLiveTrendTypeChange('line');
    });

    els.partnerLiveTrendMetricNetBtn?.addEventListener('click', () => {
      handleLiveTrendMetricChange('net');
    });

    els.partnerLiveTrendMetricGrossBtn?.addEventListener('click', () => {
      handleLiveTrendMetricChange('gross');
    });

    els.partnerLiveTrendMetricOrdersBtn?.addEventListener('click', () => {
      handleLiveTrendMetricChange('orders');
    });

    els.partnerLiveTrendMetricSoldBtn?.addEventListener('click', () => {
      handleLiveTrendMetricChange('sold');
    });

    els.partnerAnalyticsCategoryChips?.addEventListener('click', async (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-analytics-category-chip]') : null;
      if (!target) return;
      const value = String(target.getAttribute('data-analytics-category-chip') || '').trim().toLowerCase();
      if (!value) return;
      if (state.analytics.category === value) return;
      state.analytics.category = value;
      if (els.partnerAnalyticsCategoryFilter) {
        els.partnerAnalyticsCategoryFilter.value = value;
      }
      syncAnalyticsCategoryOptions();
      await refreshPartnerAnalyticsView();
    });

    els.btnPartnerAnalyticsRefresh?.addEventListener('click', async () => {
      await refreshPartnerAnalyticsView();
    });

    els.availabilityBulkMode?.addEventListener('change', async () => {
      setAvailabilityBulkMode(Boolean(els.availabilityBulkMode?.checked));
      await loadCalendarMonthData();
    });

    els.btnAvailabilitySelectAllType?.addEventListener('click', async () => {
      const type = String(els.blockResourceType?.value || '').trim();
      if (!type) return;
      try {
        const rows = await ensureResourcesLoadedForType(type);
        const set = ensureSelectedSetForType(type);
        (rows || []).forEach((r) => {
          if (!r?.id) return;
          set.add(String(r.id));
        });
        updateAvailabilitySelectionSummary();
        renderResourcePanels();
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Failed to select all'}`, 'error');
      }
    });

    els.btnAvailabilityClearAll?.addEventListener('click', () => {
      clearAvailabilitySelectionsAll();
      updateAvailabilitySelectionSummary();
      renderResourcePanels();
    });

    const handleCopyReferral = async (value) => {
      const link = String(value || '').trim();
      if (!link || link.toLowerCase().includes('set your referral code')) {
        showToast('Set your referral code to enable referral link.', 'error');
        return;
      }
      try {
        const ok = await copyTextToClipboard(link);
        if (!ok) throw new Error('Copy failed');
        showToast('Referral link copied', 'success');
      } catch (error) {
        console.error(error);
        showToast('Failed to copy referral link', 'error');
      }
    };

    const handleCopyReferralCode = async (value) => {
      const code = String(value || '').trim();
      if (!code) {
        showToast('Set your referral code to enable referral code.', 'error');
        return;
      }
      try {
        const ok = await copyTextToClipboard(code);
        if (!ok) throw new Error('Copy failed');
        showToast('Referral code copied', 'success');
      } catch (error) {
        console.error(error);
        showToast('Failed to copy referral code', 'error');
      }
    };

    els.btnPartnerCopyReferralLink?.addEventListener('click', async () => {
      await handleCopyReferral(els.partnerReferralLink?.value);
    });

    els.btnPartnerCopyReferralLinkSummary?.addEventListener('click', async () => {
      await handleCopyReferral(els.partnerReferralLinkSummary?.value);
    });

    els.btnPartnerCopyReferralCodeSummary?.addEventListener('click', async () => {
      await handleCopyReferralCode(els.partnerReferralCodeSummary?.value);
    });

    els.btnPartnerCopyReferralLinkLarge?.addEventListener('click', async () => {
      await handleCopyReferral(els.partnerReferralLinkLarge?.value);
    });

    els.btnPartnerCopyReferralCodeLarge?.addEventListener('click', async () => {
      await handleCopyReferralCode(els.partnerReferralCodeLarge?.value);
    });

    els.btnPartnerReferralOrdersRefresh?.addEventListener('click', async () => {
      try {
        await refreshReferralOrdersPanel();
      } catch (error) {
        console.error(error);
        showToast('Failed to refresh referral-attributed orders', 'error');
      }
    });

    els.partnerReferralTreeSearch?.addEventListener('input', () => {
      referralTreeQuery = String(els.partnerReferralTreeSearch?.value || '');
      renderReferralTree();
    });

    els.btnPartnerReferralExpandAll?.addEventListener('click', () => {
      setAllReferralTreeExpanded(true);
      renderReferralTree();
    });

    els.btnPartnerReferralCollapseAll?.addEventListener('click', () => {
      setAllReferralTreeExpanded(false);
      renderReferralTree();
    });

    els.btnPartnerAffiliateCashout?.addEventListener('click', async () => {
      if (!state.sb || !state.selectedPartnerId) return;
      if (!confirm('Request a cash out? Admin will be notified and will contact you.')) return;
      try {
        els.btnPartnerAffiliateCashout.disabled = true;
        const { data, error } = await state.sb.rpc('affiliate_request_cashout', { p_partner_id: state.selectedPartnerId });
        if (error) throw error;
        if (!data) throw new Error('Cash out request failed');
        showToast('Cash out requested. Admin has been notified.', 'success');
        await refreshAffiliatePanel();
        await refreshAffiliateSummaryCard();
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Cash out failed'}`, 'error');
        els.btnPartnerAffiliateCashout.disabled = false;
      }
    });

    els.btnPartnerAffiliateSummaryCashout?.addEventListener('click', async () => {
      if (!state.sb || !state.selectedPartnerId) return;
      if (!confirm('Request a cash out? Admin will be notified and will contact you.')) return;
      try {
        els.btnPartnerAffiliateSummaryCashout.disabled = true;
        const { data, error } = await state.sb.rpc('affiliate_request_cashout', { p_partner_id: state.selectedPartnerId });
        if (error) throw error;
        if (!data) throw new Error('Cash out request failed');
        showToast('Cash out requested. Admin has been notified.', 'success');
        await refreshAffiliatePanel();
        await refreshAffiliateSummaryCard();
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Cash out failed'}`, 'error');
        els.btnPartnerAffiliateSummaryCashout.disabled = false;
      }
    });

    els.partnerProfileNameForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.sb || !state.user?.id) return;
      const next = String(els.partnerProfileNameInput?.value || '').trim();
      try {
        const { error } = await state.sb.from('profiles').update({ name: next || null }).eq('id', state.user.id);
        if (error) throw error;
        try {
          await state.sb.auth.updateUser({ data: { name: next || null } });
        } catch (_e) {
        }
        await loadMyProfile();
        renderProfileSettings();
        showToast('Name updated', 'success');
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Update failed'}`, 'error');
      }
    });

    els.partnerProfilePayoutForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.sb || !state.user?.id) return;
      if (!state.selectedPartnerId) {
        showToast('Select partner first.', 'error');
        return;
      }

      const pid = String(state.selectedPartnerId || '').trim();
      const canEdit = pid && Array.isArray(state.memberships) && state.memberships.some((m) => String(m?.partner_id || '') === pid && String(m?.role || '') === 'owner');
      if (!canEdit) {
        showToast('Only partner owner can edit payout details.', 'error');
        return;
      }

      const payload = {
        partner_id: state.selectedPartnerId,
        account_holder_name: String(els.partnerProfilePayoutAccountHolder?.value || '').trim() || null,
        bank_name: String(els.partnerProfilePayoutBankName?.value || '').trim() || null,
        iban: String(els.partnerProfilePayoutIban?.value || '').trim() || null,
        bic: String(els.partnerProfilePayoutBic?.value || '').trim() || null,
        notes: String(els.partnerProfilePayoutNotes?.value || '').trim() || null,
      };

      try {
        const { error } = await state.sb
          .from('partner_payout_details')
          .upsert(payload, { onConflict: 'partner_id' });
        if (error) throw error;
        showToast('Payout details saved.', 'success');
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Save failed'}`, 'error');
      }
    });

    els.partnerProfileUsernameForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.sb || !state.user?.id) return;
      const next = String(els.partnerProfileUsernameInput?.value || '').trim();
      if (!next || !USERNAME_PATTERN.test(next)) {
        showToast('Invalid username. Use 3-30 chars: letters, digits, dot, underscore or dash.', 'error');
        return;
      }

      try {
        const payloads = [
          { username: next, username_normalized: next.toLowerCase() },
          { username: next },
        ];

        let updated = false;
        for (const payload of payloads) {
          const { error } = await state.sb.from('profiles').update(payload).eq('id', state.user.id);
          if (!error) {
            updated = true;
            break;
          }
          const msg = String(error.message || '').toLowerCase();
          const det = String(error.details || '').toLowerCase();
          const hint = `${msg} ${det}`;
          if ('username_normalized' in payload && hint.includes('username_normalized')) {
            continue;
          }
          throw error;
        }

        if (!updated) {
          throw new Error('Update failed');
        }

        try {
          await state.sb.auth.updateUser({ data: { username: next } });
        } catch (_e) {
        }

        await loadMyProfile();
        renderProfileSettings();
        await refreshReferralWidget();
        showToast('Username updated', 'success');
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Update failed'}`, 'error');
      }
    });

    els.partnerProfileEmailForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.sb) return;
      const next = String(els.partnerProfileEmailInput?.value || '').trim();
      if (!next || !next.includes('@')) {
        showToast('Please enter a valid email address', 'error');
        return;
      }
      try {
        const { error } = await state.sb.auth.updateUser({ email: next });
        if (error) throw error;
        showToast('Email update requested. Check your inbox.', 'success');
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Update failed'}`, 'error');
      }
    });

    els.partnerProfilePasswordForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.sb) return;
      const currentPassword = String(els.partnerProfilePasswordCurrent?.value || '');
      const newPassword = String(els.partnerProfilePasswordNew?.value || '');
      const confirmPassword = String(els.partnerProfilePasswordConfirm?.value || '');

      if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all password fields', 'error');
        return;
      }
      if (newPassword.length < 8) {
        showToast('New password must be at least 8 characters', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      try {
        const email = state.user?.email;
        if (!email) {
          throw new Error('Missing account email');
        }

        const { error: reauthError } = await state.sb.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (reauthError) throw reauthError;

        const { error } = await state.sb.auth.updateUser({ password: newPassword });
        if (error) throw error;

        if (els.partnerProfilePasswordForm) els.partnerProfilePasswordForm.reset();
        showToast('Password updated', 'success');
      } catch (error) {
        console.error(error);
        showToast(`Error: ${error.message || 'Update failed'}`, 'error');
      }
    });

    if (els.blockForm) {
      els.blockForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!state.selectedPartnerId) return;

        const resourceType = els.blockResourceType?.value || '';
        const resourceId = (els.blockResourceId?.value || '').trim();
        const startDate = els.blockStart?.value || '';
        const endDate = els.blockEnd?.value || '';
        const note = (els.blockNote?.value || '').trim();

        if (!resourceType || !startDate || !endDate) {
          showToast('Please fill in all required fields', 'error');
          return;
        }

        try {
          if (state.availability.bulkMode) {
            const targets = await getAvailabilityTargets();
            if (!targets.length) {
              showToast('No target resources selected', 'error');
              return;
            }
            await createRangeBlocksForTargets(startDate, endDate, note, targets);
            if (els.blockNote) els.blockNote.value = '';
            await refreshCalendar();
            return;
          }

          if (!resourceId) {
            showToast('Please fill in all required fields', 'error');
            return;
          }

          const payload = {
            partner_id: state.selectedPartnerId,
            resource_type: resourceType,
            resource_id: resourceId,
            start_date: startDate,
            end_date: endDate,
            note: note || null,
            created_by: state.user?.id || null,
          };

          const { error } = await state.sb.from('partner_availability_blocks').insert(payload);
          if (error) throw error;

          showToast('Block created', 'success');

          if (els.blockNote) els.blockNote.value = '';

          await refreshCalendar();
        } catch (error) {
          console.error(error);
          showToast(`Error: ${error.message || 'Create failed'}`, 'error');
        }
      });
    }

    els.blockResourceType?.addEventListener('change', async () => {
      await loadBlocks();
      syncResourceTypeOptions();
      renderResourceTypePanels();
      await loadCalendarResourceOptions();
      await loadCalendarMonthData();
    });

    els.blockResourceId?.addEventListener('change', async () => {
      if (state.availability.bulkMode) {
        const type = String(els.blockResourceType?.value || '').trim();
        const resourceId = String(els.blockResourceId?.value || '').trim();
        if (type && resourceId) {
          ensureSelectedSetForType(type).add(resourceId);
        }
        updateAvailabilitySelectionSummary();
      }
      renderResourcePanels();
      await loadCalendarMonthData();
    });

    els.calendarPrevMonth?.addEventListener('click', async () => {
      ensureCalendarMonthInput();
      setCalendarMonthInput(addMonths(state.calendar.monthValue || getMonthValue(), -1));
      await loadCalendarMonthData();
    });

    els.calendarNextMonth?.addEventListener('click', async () => {
      ensureCalendarMonthInput();
      setCalendarMonthInput(addMonths(state.calendar.monthValue || getMonthValue(), 1));
      await loadCalendarMonthData();
    });

    els.calendarMonthInput?.addEventListener('change', async () => {
      state.calendar.monthValue = els.calendarMonthInput?.value || getMonthValue();
      await loadCalendarMonthData();
    });

    if (state.sb?.auth?.onAuthStateChange) {
      state.sb.auth.onAuthStateChange((event, session) => {
        const previousUserId = String(state.user?.id || '').trim();
        const nextUserId = String(session?.user?.id || '').trim();
        state.session = session;
        state.user = session?.user || null;
        if (!session) {
          stopBlocksRealtime();
          stopAnalyticsRealtime();
        }
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          return;
        }
        if (event === 'SIGNED_IN' && previousUserId && previousUserId === nextUserId) {
          return;
        }
        queueBootstrapFromAuth();
      });
    }

  }

  function cacheEls() {
    els.warning = $('partnerPortalWarning');
    els.loginPrompt = $('partnerPortalLoginPrompt');
    els.btnOpenLogin = $('btnPartnerOpenLogin');
    els.btnHeaderLogin = $('btnPartnerHeaderLogin');
    els.noPartner = $('partnerPortalNoPartner');
    els.servicesCard = $('partnerServicesCard');
    els.servicesTipsCard = $('partnerServicesTipsCard');
    els.app = $('partnerPortalApp');
    els.status = $('partnerPortalStatus');
    els.partnerSelect = $('partnerSelect');
    els.btnRefresh = $('btnPartnerRefresh');
    els.suspendedInfo = $('partnerSuspendedInfo');

    els.partnerDetailsModal = $('partnerDetailsModal');
    els.partnerDetailsDialog = els.partnerDetailsModal?.querySelector('.modal__dialog') || null;
    els.partnerDetailsClose = els.partnerDetailsModal?.querySelector('[data-partner-details-close]') || null;
    els.partnerDetailsTitle = $('partnerDetailsTitle');
    els.partnerDetailsMeta = $('partnerDetailsMeta');
    els.partnerDetailsStatus = $('partnerDetailsStatus');
    els.partnerDetailsBody = $('partnerDetailsBody');
    els.partnerDetailsActions = $('partnerDetailsActions');

    els.tabFulfillments = $('partnerTabFulfillments');
    els.tabCalendar = $('partnerTabCalendar');
    els.tabBtnFulfillments = $('partnerTabBtnFulfillments');
    els.tabBtnCalendar = $('partnerTabBtnCalendar');

    els.fulfillmentsHint = $('fulfillmentsHint');
    els.fulfillmentsBody = $('fulfillmentsTableBody');
    els.fulfillmentsTableContainer = $('partnerFulfillmentsTableContainer');
    els.btnOrdersFilterToggle = $('btnPartnerOrdersFilterToggle');
    els.ordersFilterBody = $('partnerOrdersFilterBody');
    els.ordersFilterCurrent = $('partnerOrdersFilterCurrent');
    els.ordersFilterToggleState = $('partnerOrdersFilterToggleState');
    els.ordersStatusButtons = Array.from(document.querySelectorAll('[data-orders-status-filter]'));
    els.btnOrdersToggleCompact = $('btnPartnerOrdersToggleCompact');
    els.btnOrdersClearFilters = $('btnPartnerOrdersClearFilters');
    els.ordersFilterHint = $('partnerOrdersFilterHint');
    els.btnOrdersCalendarToggle = $('btnPartnerOrdersCalendarToggle');
    els.ordersCalendarBody = $('partnerOrdersCalendarBody');
    els.ordersCalendarToggleState = $('partnerOrdersCalendarToggleState');
    els.ordersCalendarMonthInput = $('partnerOrdersCalendarMonthInput');
    els.btnOrdersCalendarPrevMonth = $('btnPartnerOrdersCalendarPrevMonth');
    els.btnOrdersCalendarNextMonth = $('btnPartnerOrdersCalendarNextMonth');
    els.ordersCalendarGrid = $('partnerOrdersCalendarGrid');
    els.ordersDayListHint = $('partnerOrdersDayListHint');
    els.ordersCalendarList = $('partnerOrdersCalendarList');
    els.kpiPending = $('kpiPending');
    els.kpiAccepted = $('kpiAccepted');
    els.kpiRejected = $('kpiRejected');

    els.blocksBody = $('blocksTableBody');
    els.blockForm = $('partnerBlockForm');
    els.blockResourceType = $('blockResourceType');
    els.blockResourceId = $('blockResourceId');
    els.resourceTypePanels = $('partnerResourceTypePanels');
    els.resourcePanels = $('partnerResourcePanels');
    els.calendarMonthInput = $('partnerCalendarMonthInput');
    els.calendarPrevMonth = $('partnerCalendarPrevMonth');
    els.calendarNextMonth = $('partnerCalendarNextMonth');
    els.calendarMonthGrid = $('partnerCalendarMonthGrid');
    els.blockStart = $('blockStart');
    els.blockEnd = $('blockEnd');
    els.blockNote = $('blockNote');

    els.availabilityBulkMode = $('partnerAvailabilityBulkMode');
    els.btnAvailabilitySelectAllType = $('btnPartnerAvailabilitySelectAllType');
    els.btnAvailabilityClearAll = $('btnPartnerAvailabilityClearAll');
    els.availabilitySelectionSummary = $('partnerAvailabilitySelectionSummary');

    els.partnerAnalyticsCard = $('partnerAnalyticsCard');
    els.partnerAnalOrdersAccepted = $('partnerAnalOrdersAccepted');
    els.partnerAnalOrdersPending = $('partnerAnalOrdersPending');
    els.partnerAnalOrdersAwaiting = $('partnerAnalOrdersAwaiting');
    els.partnerAnalOrdersTotal = $('partnerAnalOrdersTotal');
    els.partnerAnalPartnerEarnings = $('partnerAnalPartnerEarnings');
    els.partnerAnalInvited = $('partnerAnalInvited');
    els.partnerAnalHint = $('partnerAnalHint');

    els.adminMenuToggle = $('adminMenuToggle');
    els.adminSidebar = $('adminSidebar');
    els.adminSidebarOverlay = $('adminSidebarOverlay');
    els.partnerSidebarNav = $('partnerSidebarNav');
    els.partnerNavAll = $('partnerNavAll');
    els.partnerNavShop = $('partnerNavShop');
    els.partnerNavCars = $('partnerNavCars');
    els.partnerNavTrips = $('partnerNavTrips');
    els.partnerNavHotels = $('partnerNavHotels');
    els.partnerNavTransport = $('partnerNavTransport');
    els.partnerNavBlog = $('partnerNavBlog');
    els.partnerNavCalendar = $('partnerNavCalendar');
    els.partnerNavAnalytics = $('partnerNavAnalytics');
    els.partnerNavProfile = $('partnerNavProfile');
    els.partnerNavReferrals = $('partnerNavReferrals');
    els.partnerNavLinksDiscounts = $('partnerNavLinksDiscounts');
    els.partnerUserName = $('partnerUserName');
    els.partnerBreadcrumb = $('partnerBreadcrumb');

    els.partnerPortalView = $('partnerPortalView');
    els.partnerBlogView = $('partnerBlogView');
    els.partnerAnalyticsView = $('partnerAnalyticsView');
    els.partnerProfileView = $('partnerProfileView');
    els.partnerReferralsView = $('partnerReferralsView');
    els.partnerLinksDiscountsView = $('partnerLinksDiscountsView');
    els.partnerLinksViewTabs = $('partnerLinksViewTabs');
    els.partnerLinksFilters = $('partnerLinksFilters');
    els.btnPartnerLinksRefresh = $('btnPartnerLinksRefresh');
    els.partnerLinksServicesPanel = $('partnerLinksServicesPanel');
    els.partnerLinksDiscountsPanel = $('partnerLinksDiscountsPanel');
    els.partnerLinksGrid = $('partnerLinksGrid');
    els.partnerLinksPreviewModal = $('partnerLinksPreviewModal');
    els.partnerLinksPreviewModalOverlay = $('partnerLinksPreviewModalOverlay');
    els.btnClosePartnerLinksPreview = $('btnClosePartnerLinksPreview');
    els.partnerLinksPreviewIntro = $('partnerLinksPreviewIntro');
    els.partnerLinksPreviewImage = $('partnerLinksPreviewImage');
    els.partnerLinksPreviewCategory = $('partnerLinksPreviewCategory');
    els.partnerLinksPreviewTitle = $('partnerLinksPreviewTitle');
    els.partnerLinksPreviewMeta = $('partnerLinksPreviewMeta');
    els.partnerLinksPreviewDescription = $('partnerLinksPreviewDescription');
    els.partnerLinksPreviewTransportBox = $('partnerLinksPreviewTransportBox');
    els.partnerLinksPreviewTransportPrice = $('partnerLinksPreviewTransportPrice');
    els.partnerLinksPreviewTransportNote = $('partnerLinksPreviewTransportNote');
    els.partnerLinksPreviewLandingLinkPl = $('partnerLinksPreviewLandingLinkPl');
    els.partnerLinksPreviewLandingLinkEn = $('partnerLinksPreviewLandingLinkEn');
    els.partnerLinksPreviewOfferLinkPl = $('partnerLinksPreviewOfferLinkPl');
    els.partnerLinksPreviewOfferLinkEn = $('partnerLinksPreviewOfferLinkEn');
    els.btnPartnerLinksCopyLandingPl = $('btnPartnerLinksCopyLandingPl');
    els.btnPartnerLinksCopyLandingEn = $('btnPartnerLinksCopyLandingEn');
    els.btnPartnerLinksCopyOfferPl = $('btnPartnerLinksCopyOfferPl');
    els.btnPartnerLinksCopyOfferEn = $('btnPartnerLinksCopyOfferEn');
    els.btnPartnerLinksOpenLanding = $('btnPartnerLinksOpenLanding');
    els.btnPartnerLinksOpenOffer = $('btnPartnerLinksOpenOffer');
    els.partnerDiscountCodesList = $('partnerDiscountCodesList');

    els.partnerBlogCurrentPartner = $('partnerBlogCurrentPartner');
    els.partnerBlogStatusHint = $('partnerBlogStatusHint');
    els.partnerBlogSearch = $('partnerBlogSearch');
    els.partnerBlogStatusFilter = $('partnerBlogStatusFilter');
    els.partnerBlogTableBody = $('partnerBlogTableBody');
    els.partnerBlogStatTotal = $('partnerBlogStatTotal');
    els.partnerBlogStatDraft = $('partnerBlogStatDraft');
    els.partnerBlogStatPending = $('partnerBlogStatPending');
    els.partnerBlogStatApproved = $('partnerBlogStatApproved');
    els.btnPartnerBlogRefresh = $('btnPartnerBlogRefresh');
    els.btnPartnerBlogNew = $('btnPartnerBlogNew');
    els.partnerBlogModal = $('partnerBlogModal');
    els.partnerBlogModalOverlay = $('partnerBlogModalOverlay');
    els.btnClosePartnerBlogModal = $('btnClosePartnerBlogModal');
    els.partnerBlogModalTitle = $('partnerBlogModalTitle');
    ensurePartnerBlogModalPortal();
    els.partnerBlogForm = $('partnerBlogForm');
    els.partnerBlogFormId = $('partnerBlogFormId');
    els.partnerBlogFormStatus = $('partnerBlogFormStatus');
    els.partnerBlogFormCoverUrl = $('partnerBlogFormCoverUrl');
    els.btnPartnerBlogCoverUpload = $('btnPartnerBlogCoverUpload');
    els.partnerBlogFormCoverFile = $('partnerBlogFormCoverFile');
    els.partnerBlogFormCoverPreview = $('partnerBlogFormCoverPreview');
    els.partnerBlogFormCoverPreviewImage = $('partnerBlogFormCoverPreviewImage');
    els.partnerBlogFormCategoriesPl = $('partnerBlogFormCategoriesPl');
    els.partnerBlogFormCategoriesPlSelected = $('partnerBlogFormCategoriesPlSelected');
    els.partnerBlogFormCategoriesPlInput = $('partnerBlogFormCategoriesPlInput');
    els.partnerBlogFormCategoriesPlSuggestions = $('partnerBlogFormCategoriesPlSuggestions');
    els.partnerBlogFormCategoriesEn = $('partnerBlogFormCategoriesEn');
    els.partnerBlogFormCategoriesEnSelected = $('partnerBlogFormCategoriesEnSelected');
    els.partnerBlogFormCategoriesEnInput = $('partnerBlogFormCategoriesEnInput');
    els.partnerBlogFormCategoriesEnSuggestions = $('partnerBlogFormCategoriesEnSuggestions');
    els.partnerBlogFormTagsPl = $('partnerBlogFormTagsPl');
    els.partnerBlogFormTagsPlSelected = $('partnerBlogFormTagsPlSelected');
    els.partnerBlogFormTagsPlInput = $('partnerBlogFormTagsPlInput');
    els.partnerBlogFormTagsPlSuggestions = $('partnerBlogFormTagsPlSuggestions');
    els.partnerBlogFormTagsEn = $('partnerBlogFormTagsEn');
    els.partnerBlogFormTagsEnSelected = $('partnerBlogFormTagsEnSelected');
    els.partnerBlogFormTagsEnInput = $('partnerBlogFormTagsEnInput');
    els.partnerBlogFormTagsEnSuggestions = $('partnerBlogFormTagsEnSuggestions');
    els.partnerBlogEditorRuntimeNote = $('partnerBlogEditorRuntimeNote');
    els.btnPartnerBlogAddCta = $('btnPartnerBlogAddCta');
    els.partnerBlogFormCtaRows = $('partnerBlogFormCtaRows');
    els.btnPartnerBlogDelete = $('btnPartnerBlogDelete');
    els.btnPartnerBlogCancel = $('btnPartnerBlogCancel');
    els.btnPartnerBlogSaveDraft = $('btnPartnerBlogSaveDraft');
    els.btnPartnerBlogSubmit = $('btnPartnerBlogSubmit');
    els.btnPartnerBlogSave = $('btnPartnerBlogSave');

    els.partnerAnalyticsPeriodType = $('partnerAnalyticsPeriodType');
    els.partnerAnalyticsPeriodYearBtn = $('partnerAnalyticsPeriodYearBtn');
    els.partnerAnalyticsPeriodMonthBtn = $('partnerAnalyticsPeriodMonthBtn');
    els.partnerAnalyticsMonth = $('partnerAnalyticsMonth');
    els.partnerAnalyticsMonthWrap = $('partnerAnalyticsMonthWrap');
    els.partnerAnalyticsYear = $('partnerAnalyticsYear');
    els.partnerAnalyticsYearWrap = $('partnerAnalyticsYearWrap');
    els.partnerAnalyticsCategoryFilter = $('partnerAnalyticsCategoryFilter');
    els.btnPartnerAnalyticsRefresh = $('btnPartnerAnalyticsRefresh');
    els.partnerAnalyticsRangeLabel = $('partnerAnalyticsRangeLabel');
    els.partnerAnalyticsStatus = $('partnerAnalyticsStatus');
    els.partnerAnalyticsLiveTrendHint = $('partnerAnalyticsLiveTrendHint');
    els.partnerLiveTrendTypeBarBtn = $('partnerLiveTrendTypeBarBtn');
    els.partnerLiveTrendTypeLineBtn = $('partnerLiveTrendTypeLineBtn');
    els.partnerLiveTrendMetricNetBtn = $('partnerLiveTrendMetricNetBtn');
    els.partnerLiveTrendMetricGrossBtn = $('partnerLiveTrendMetricGrossBtn');
    els.partnerLiveTrendMetricOrdersBtn = $('partnerLiveTrendMetricOrdersBtn');
    els.partnerLiveTrendMetricSoldBtn = $('partnerLiveTrendMetricSoldBtn');
    els.partnerAnalyticsCategoryChips = $('partnerAnalyticsCategoryChips');
    els.partnerAnalyticsLiveChartCard = $('partnerAnalyticsLiveChartCard');
    els.partnerAnalyticsLiveChart = $('partnerAnalyticsLiveChart');
    els.partnerAnalyticsResponseChartCard = $('partnerAnalyticsResponseChartCard');
    els.partnerAnalyticsResponseChart = $('partnerAnalyticsResponseChart');

    els.partnerAnalyticsKpiGross = $('partnerAnalyticsKpiGross');
    els.partnerAnalyticsKpiNet = $('partnerAnalyticsKpiNet');
    els.partnerAnalyticsKpiSold = $('partnerAnalyticsKpiSold');
    els.partnerAnalyticsKpiTotal = $('partnerAnalyticsKpiTotal');
    els.partnerAnalyticsKpiAvg = $('partnerAnalyticsKpiAvg');
    els.partnerAnalyticsKpiPending = $('partnerAnalyticsKpiPending');
    els.partnerAnalyticsKpiAwaiting = $('partnerAnalyticsKpiAwaiting');
    els.partnerAnalyticsKpiCancelled = $('partnerAnalyticsKpiCancelled');
    els.partnerAnalyticsKpiResponseAvg = $('partnerAnalyticsKpiResponseAvg');
    els.partnerAnalyticsKpiResponseCount = $('partnerAnalyticsKpiResponseCount');

    els.partnerAnalyticsByTypeBody = $('partnerAnalyticsByTypeBody');
    els.partnerAnalyticsTimeseriesHead = $('partnerAnalyticsTimeseriesHead');
    els.partnerAnalyticsTimeseriesBody = $('partnerAnalyticsTimeseriesBody');
    els.partnerAnalyticsTopOffersBody = $('partnerAnalyticsTopOffersBody');
    els.partnerAnalyticsTopProductsBody = $('partnerAnalyticsTopProductsBody');
    els.partnerAnalyticsByTypeCard = $('partnerAnalyticsByTypeCard');
    els.partnerAnalyticsTimeseriesCard = $('partnerAnalyticsTimeseriesCard');
    els.partnerAnalyticsTopOffersCard = $('partnerAnalyticsTopOffersCard');
    els.partnerAnalyticsTopProductsCard = $('partnerAnalyticsTopProductsCard');

    els.partnerReferralWidget = $('partnerReferralWidget');
    els.partnerReferralCount = $('partnerReferralCount');
    els.partnerReferralLink = $('partnerReferralLink');
    els.btnPartnerCopyReferralLink = $('btnPartnerCopyReferralLink');

    els.partnerReferralSummary = $('partnerReferralSummary');
    els.partnerReferralCountSummary = $('partnerReferralCountSummary');
    els.partnerReferralLinkSummary = $('partnerReferralLinkSummary');
    els.btnPartnerCopyReferralLinkSummary = $('btnPartnerCopyReferralLinkSummary');
    els.partnerReferralCodeSummary = $('partnerReferralCodeSummary');
    els.btnPartnerCopyReferralCodeSummary = $('btnPartnerCopyReferralCodeSummary');

    els.partnerReferralLinkLarge = $('partnerReferralLinkLarge');
    els.btnPartnerCopyReferralLinkLarge = $('btnPartnerCopyReferralLinkLarge');
    els.partnerReferralCodeLarge = $('partnerReferralCodeLarge');
    els.btnPartnerCopyReferralCodeLarge = $('btnPartnerCopyReferralCodeLarge');

    els.partnerReferralStatDirect = $('partnerReferralStatDirect');
    els.partnerReferralOrdersCard = $('partnerReferralOrdersCard');
    els.btnPartnerReferralOrdersRefresh = $('btnPartnerReferralOrdersRefresh');
    els.partnerReferralOrdersTotal = $('partnerReferralOrdersTotal');
    els.partnerReferralOrdersGross = $('partnerReferralOrdersGross');
    els.partnerReferralOrdersManual = $('partnerReferralOrdersManual');
    els.partnerReferralOrdersLink = $('partnerReferralOrdersLink');
    els.partnerReferralOrdersBody = $('partnerReferralOrdersBody');

    els.partnerReferralTreeContainer = $('partnerReferralTreeContainer');
    els.partnerReferralTreeSearch = $('partnerReferralTreeSearch');
    els.btnPartnerReferralExpandAll = $('btnPartnerReferralExpandAll');
    els.btnPartnerReferralCollapseAll = $('btnPartnerReferralCollapseAll');

    els.partnerAffiliateCard = $('partnerAffiliateCard');
    els.partnerAffiliateUnpaid = $('partnerAffiliateUnpaid');
    els.partnerAffiliatePending = $('partnerAffiliatePending');
    els.partnerAffiliatePaid = $('partnerAffiliatePaid');
    els.partnerAffiliateThreshold = $('partnerAffiliateThreshold');
    els.partnerAffiliateProgressText = $('partnerAffiliateProgressText');
    els.partnerAffiliateProgressBar = $('partnerAffiliateProgressBar');
    els.btnPartnerAffiliateCashout = $('btnPartnerAffiliateCashout');
    els.partnerAffiliateCashoutHint = $('partnerAffiliateCashoutHint');
    els.partnerAffiliateEarningsBody = $('partnerAffiliateEarningsBody');

    els.partnerAffiliateSummaryCard = $('partnerAffiliateSummaryCard');
    els.partnerAffiliateSummarySubtitle = $('partnerAffiliateSummarySubtitle');
    els.partnerAffiliateSummaryMetrics = $('partnerAffiliateSummaryMetrics');
    els.partnerAffiliateSummaryActions = $('partnerAffiliateSummaryActions');
    els.partnerAffiliateSummaryUnpaid = $('partnerAffiliateSummaryUnpaid');
    els.partnerAffiliateSummaryPending = $('partnerAffiliateSummaryPending');
    els.partnerAffiliateSummaryPaid = $('partnerAffiliateSummaryPaid');
    els.partnerAffiliateSummaryThreshold = $('partnerAffiliateSummaryThreshold');
    els.partnerAffiliateSummaryProgressText = $('partnerAffiliateSummaryProgressText');
    els.partnerAffiliateSummaryProgressBar = $('partnerAffiliateSummaryProgressBar');
    els.btnPartnerAffiliateSummaryCashout = $('btnPartnerAffiliateSummaryCashout');
    els.partnerAffiliateSummaryCashoutHint = $('partnerAffiliateSummaryCashoutHint');

    els.partnerPortalResponseCard = $('partnerPortalResponseCard');
    els.partnerPortalEarningsValue = $('partnerPortalEarningsValue');
    els.partnerPortalResponseYearAvg = $('partnerPortalResponseYearAvg');

    els.partnerProfileMessage = $('partnerProfileMessage');
    els.partnerProfileEmailDisplay = $('partnerProfileEmailDisplay');
    els.partnerProfileUsernameDisplay = $('partnerProfileUsernameDisplay');
    els.partnerProfileNameDisplay = $('partnerProfileNameDisplay');
    els.partnerProfileNameForm = $('partnerProfileNameForm');
    els.partnerProfileNameInput = $('partnerProfileNameInput');
    els.partnerProfileUsernameForm = $('partnerProfileUsernameForm');
    els.partnerProfileUsernameInput = $('partnerProfileUsernameInput');
    els.partnerProfileEmailForm = $('partnerProfileEmailForm');
    els.partnerProfileEmailInput = $('partnerProfileEmailInput');
    els.partnerProfilePasswordForm = $('partnerProfilePasswordForm');
    els.partnerProfilePasswordCurrent = $('partnerProfilePasswordCurrent');
    els.partnerProfilePasswordNew = $('partnerProfilePasswordNew');
    els.partnerProfilePasswordConfirm = $('partnerProfilePasswordConfirm');

    els.partnerProfilePayoutForm = $('partnerProfilePayoutForm');
    els.partnerProfilePayoutPartnerName = $('partnerProfilePayoutPartnerName');
    els.partnerProfilePayoutAccountHolder = $('partnerProfilePayoutAccountHolder');
    els.partnerProfilePayoutBankName = $('partnerProfilePayoutBankName');
    els.partnerProfilePayoutIban = $('partnerProfilePayoutIban');
    els.partnerProfilePayoutBic = $('partnerProfilePayoutBic');
    els.partnerProfilePayoutNotes = $('partnerProfilePayoutNotes');

    els.partnerPushStatus = $('partnerPushStatus');
    els.partnerPushHint = $('partnerPushHint');
    els.btnPartnerEnablePush = $('btnPartnerEnablePush');
    els.btnPartnerDisablePush = $('btnPartnerDisablePush');
  }

  async function init() {
    cacheEls();

    hideSelectForPanels(els.blockResourceType);
    hideSelectForPanels(els.blockResourceId);

    setAvailabilityBulkMode(state.availability.bulkMode);

    state.sb = typeof window.getSupabase === 'function' ? window.getSupabase() : window.supabase;

    if (!state.sb) {
      showWarning('Supabase is not loaded yet. Please refresh.');
      return;
    }

    attachEventListeners();
    await bootstrapPortal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
