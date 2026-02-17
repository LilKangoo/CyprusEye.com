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
    blocks: [],
    calendar: {
      resourcesByType: { shop: [], cars: [], trips: [], hotels: [] },
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
    tabFulfillments: null,
    tabCalendar: null,
    tabBtnFulfillments: null,
    tabBtnCalendar: null,
    fulfillmentsHint: null,
    fulfillmentsBody: null,
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
    partnerNavCalendar: null,
    partnerNavProfile: null,
    partnerNavReferrals: null,
    partnerUserName: null,
    partnerBreadcrumb: null,

    partnerPortalView: null,
    partnerProfileView: null,

    partnerReferralsView: null,

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
    partnerAffiliateSummaryUnpaid: null,
    partnerAffiliateSummaryPending: null,
    partnerAffiliateSummaryPaid: null,
    partnerAffiliateSummaryThreshold: null,
    partnerAffiliateSummaryProgressText: null,
    partnerAffiliateSummaryProgressBar: null,
    btnPartnerAffiliateSummaryCashout: null,
    partnerAffiliateSummaryCashoutHint: null,

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
        if (!els.tabFulfillments?.hidden && String(state.selectedCategory || 'all') === 'all' && !els.partnerAnalyticsCard?.hidden) {
          await refreshPartnerAnalytics();
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
        updateKpis();
        renderFulfillmentsTable();
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

  function showToast(message, type) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(message, type || 'info');
      return;
    }
    console.log(type || 'info', message);
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
    const hasAnyServicePermission = Boolean(partner?.can_manage_shop || partner?.can_manage_cars || partner?.can_manage_trips || partner?.can_manage_hotels);
    const affiliateEnabled = Boolean(partner?.affiliate_enabled);
    const isAffiliateOnly = Boolean(affiliateEnabled && !hasAnyServicePermission);
    return { partner, canShop, canCars, canTrips, canHotels, hasAnyServicePermission, affiliateEnabled, isAffiliateOnly };
  }

  function updateServiceSectionVisibility() {
    const { isAffiliateOnly } = getSelectedPartnerCapabilities();
    setHidden(els.servicesCard, isAffiliateOnly);
    setHidden(els.servicesTipsCard, isAffiliateOnly);
    setHidden(els.partnerNavCalendar, isAffiliateOnly);
  }

  function updateAffiliateSummaryCardVisibility() {
    const inPortal = Boolean(els.partnerPortalView && !els.partnerPortalView.hidden);
    const isAll = String(state.selectedCategory || 'all') === 'all';
    const inFulfillmentsTab = Boolean(els.tabFulfillments && !els.tabFulfillments.hidden);
    const { affiliateEnabled, isAffiliateOnly } = getSelectedPartnerCapabilities();
    const tabOk = isAffiliateOnly ? true : inFulfillmentsTab;
    const canShow = inPortal && tabOk && isAll && affiliateEnabled && Boolean(state.session && state.user && state.selectedPartnerId);
    setHidden(els.partnerAffiliateSummaryCard, !canShow);
  }

  function updateAnalyticsCardVisibility() {
    const inPortal = Boolean(els.partnerPortalView && !els.partnerPortalView.hidden);
    const inFulfillmentsTab = Boolean(els.tabFulfillments && !els.tabFulfillments.hidden);
    const isAll = String(state.selectedCategory || 'all') === 'all';
    const { hasAnyServicePermission } = getSelectedPartnerCapabilities();
    const canShow = inPortal && inFulfillmentsTab && Boolean(state.session && state.user && state.selectedPartnerId) && isAll && hasAnyServicePermission;
    setHidden(els.partnerAnalyticsCard, !canShow);
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

  function buildReferralLink(username) {
    const u = String(username || '').trim();
    if (!u) return '';
    const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : 'https://cypruseye.com';
    return `${baseUrl}/?ref=${encodeURIComponent(u)}`;
  }

  function setProfileMessage(text) {
    if (!els.partnerProfileMessage) return;
    els.partnerProfileMessage.textContent = text || '';
  }

  function setMainView(view) {
    const isProfile = view === 'profile';
    const isReferrals = view === 'referrals';
    const isPortal = !isProfile && !isReferrals;

    setHidden(els.partnerPortalView, !isPortal);
    setHidden(els.partnerProfileView, !isProfile);
    setHidden(els.partnerReferralsView, !isReferrals);

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
      els.partnerNavCalendar,
      els.partnerNavProfile,
      els.partnerNavReferrals,
    ].filter(Boolean);
    btns.forEach((b) => b.classList.toggle('active', b === targetBtn));
  }

  async function loadMyProfile() {
    if (!state.sb || !state.user?.id) return null;

    try {
      const { data, error } = await state.sb
        .from('profiles')
        .select('id,email,name,username')
        .eq('id', state.user.id)
        .maybeSingle();
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
      const { count, error } = await state.sb
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', state.user.id)
        .limit(1);
      if (error) throw error;
      const c = String(count || 0);
      setText(els.partnerReferralCount, c);
      setText(els.partnerReferralCountSummary, c);
    } catch (_e) {
      setText(els.partnerReferralCount, '0');
      setText(els.partnerReferralCountSummary, '0');
    }

    const username = String(state.profile?.username || '').trim();
    const canUse = username && !isUuid(username);
    const link = canUse ? buildReferralLink(username) : 'Set your username to enable referral link';
    const referralCode = canUse ? username : '';
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
    return 'All';
  }

  function filteredFulfillmentsForSelectedCategory() {
    const cat = String(state.selectedCategory || 'all');
    return (state.fulfillments || []).filter((f) => {
      if (cat === 'all') return true;
      if (!f) return false;
      if (cat === 'shop') return String(f.__source || '') === 'shop';
      if (String(f.__source || '') === 'shop') return false;
      return String(f.resource_type || '') === cat;
    });
  }

  function showTabOnly(tab) {
    const isFulfillments = tab === 'fulfillments';
    els.tabBtnFulfillments?.classList.toggle('is-active', isFulfillments);
    els.tabBtnCalendar?.classList.toggle('is-active', !isFulfillments);
    setHidden(els.tabFulfillments, !isFulfillments);
    setHidden(els.tabCalendar, isFulfillments);
  }

  function updateSidebarCategoryVisibility() {
    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const hasShopFulfillments = (state.fulfillments || []).some((f) => f && String(f.__source || '') === 'shop');
    const canShop = Boolean(partner?.can_manage_shop && (partner?.shop_vendor_id || hasShopFulfillments));
    const canCars = Boolean(partner?.can_manage_cars);
    const canTrips = Boolean(partner?.can_manage_trips);
    const canHotels = Boolean(partner?.can_manage_hotels);

    const { isAffiliateOnly } = getSelectedPartnerCapabilities();
    if (isAffiliateOnly) {
      setHidden(els.partnerNavShop, true);
      setHidden(els.partnerNavCars, true);
      setHidden(els.partnerNavTrips, true);
      setHidden(els.partnerNavHotels, true);
      if (String(state.selectedCategory || 'all') !== 'all') {
        state.selectedCategory = 'all';
      }
      updateServiceSectionVisibility();
      updateAnalyticsCardVisibility();
      updateAffiliateSummaryCardVisibility();
      return;
    }

    setHidden(els.partnerNavShop, !canShop);
    setHidden(els.partnerNavCars, !canCars);
    setHidden(els.partnerNavTrips, !canTrips);
    setHidden(els.partnerNavHotels, !canHotels);

    const allowed = new Set(['all', 'shop', 'cars', 'trips', 'hotels']);
    if (!canShop) allowed.delete('shop');
    if (!canCars) allowed.delete('cars');
    if (!canTrips) allowed.delete('trips');
    if (!canHotels) allowed.delete('hotels');

    if (!allowed.has(String(state.selectedCategory || 'all'))) {
      state.selectedCategory = 'all';
    }

    updateServiceSectionVisibility();
    updateAnalyticsCardVisibility();
    updateAffiliateSummaryCardVisibility();
  }

  function navToCategory(category) {
    const next = category || 'all';
    state.selectedCategory = next;

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
      return els.partnerNavAll;
    };
    setSidebarActive(btnFor(next));

    if (els.partnerBreadcrumb) {
      const crumb = els.partnerBreadcrumb.querySelector('span');
      if (crumb) crumb.textContent = `Partner Portal — ${categoryLabel(next)}`;
    }

    showTabOnly('fulfillments');
    if (String(state.selectedCategory || 'all') === 'all') {
      try {
        refreshAffiliateSummaryCard();
      } catch (_e) {
      }
    }
    if (!state.fulfillments?.length) {
      refreshFulfillments();
    } else {
      updateKpis();
      renderFulfillmentsTable();
      if (!els.partnerAnalyticsCard?.hidden) {
        startAnalyticsRealtime();
        refreshPartnerAnalytics();
      }
    }
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
      await refreshReferralStatsAndTree();
    } catch (e) {
      console.error(e);
    }
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
        .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, cars_locations, affiliate_enabled')
        .eq('id', state.selectedPartnerId)
        .limit(1));

      if (pErr && (/cars_locations/i.test(String(pErr.message || '')) || /affiliate_enabled/i.test(String(pErr.message || '')))) {
        ({ data: partners, error: pErr } = await state.sb
          .from('partners')
          .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels')
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
    return t;
  }

  function getMonthValue(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
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
    const next = value || getMonthValue();
    input.value = next;
    state.calendar.monthValue = next;
  }

  function ensureCalendarMonthInput() {
    const input = els.calendarMonthInput;
    if (!input) return;
    if (!input.value) {
      setCalendarMonthInput(getMonthValue());
    } else {
      state.calendar.monthValue = input.value;
    }
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
    return ['shop', 'cars', 'trips', 'hotels'];
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
    if (resourceType !== 'cars') {
      return {
        amount: fallbackAmount,
        currency: defaultCurrency,
        baseAmount: null,
        discountAmount: 0,
        finalAmount: null,
        couponCode: '',
        hasCoupon: false,
      };
    }

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

    const toFinite = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const finalAmount = toFinite(details?.final_rental_price);
    const baseAmount = toFinite(details?.base_rental_price);
    const discountAmountRaw = toFinite(details?.coupon_discount_amount);
    const discountAmount = discountAmountRaw == null ? 0 : Math.max(discountAmountRaw, 0);
    const couponCode = String(details?.coupon_code || '').trim().toUpperCase();

    return {
      amount: finalAmount == null ? fallbackAmount : finalAmount,
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
    const s = String(status || '');
    const colors = {
      awaiting_payment: '#6b7280',
      pending_acceptance: '#f59e0b',
      accepted: '#22c55e',
      rejected: '#ef4444',
      expired: '#ef4444',
      closed: '#6b7280',
    };
    const label = s === 'pending_acceptance'
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
    if (!message) {
      els.warning.hidden = true;
      els.warning.textContent = '';
      return;
    }
    els.warning.hidden = false;
    els.warning.textContent = message;
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
    const { data, error } = await state.sb.auth.getSession();
    if (error) throw error;
    state.session = data?.session || null;
    state.user = state.session?.user || null;
    return state.session;
  }

  async function loadMemberships() {
    const { data: partnerUsers, error } = await state.sb
      .from('partner_users')
      .select('partner_id, role')
      .eq('user_id', state.user?.id || '')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(partnerUsers) ? partnerUsers : [];
    state.memberships = rows;
    state.partnersById = {};

    const partnerIds = rows.map((r) => r.partner_id).filter(Boolean);
    if (partnerIds.length) {
      let partners = null;
      let pErr = null;

      ({ data: partners, error: pErr } = await state.sb
        .from('partners')
        .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, cars_locations, affiliate_enabled')
        .in('id', partnerIds)
        .limit(50));

      if (pErr && (/cars_locations/i.test(String(pErr.message || '')) || /affiliate_enabled/i.test(String(pErr.message || '')))) {
        ({ data: partners, error: pErr } = await state.sb
          .from('partners')
          .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels')
          .in('id', partnerIds)
          .limit(50));
      }

      if (pErr) throw pErr;

      (partners || []).forEach((partner) => {
        if (partner && partner.id) {
          state.partnersById[partner.id] = partner;
        }
      });
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
    const serviceRows = rawServiceRows.map((f) => ({ ...f, __source: 'service' }));

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

      const rt = String(f.resource_type || '');

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
        .filter((f) => String(f.resource_type || '') === 'trips' && f.resource_id)
        .map((f) => f.resource_id)
        .filter(Boolean)
    ));
    const hotelIds = Array.from(new Set(
      serviceOnly
        .filter((f) => String(f.resource_type || '') === 'hotels' && f.resource_id)
        .map((f) => f.resource_id)
        .filter(Boolean)
    ));

    const tripById = {};
    const hotelById = {};

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
          const title = normalizeTitleJson(r.title) || r.slug || String(r.id).slice(0, 8);
          const city = r.start_city ? ` — ${r.start_city}` : '';
          tripById[r.id] = `${title}${city}`;
        });
      } catch (_e) {}
    }

    if (hotelIds.length) {
      try {
        const { data, error } = await state.sb
          .from('hotels')
          .select('id, slug, title, city')
          .in('id', hotelIds)
          .limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const title = normalizeTitleJson(r.title) || r.slug || String(r.id).slice(0, 8);
          const city = r.city ? ` — ${r.city}` : '';
          hotelById[r.id] = `${title}${city}`;
        });
      } catch (_e) {}
    }

    if (tripIds.length || hotelIds.length) {
      filteredMerged.forEach((f) => {
        if (!f || f.__source !== 'service') return;
        if (String(f.resource_type || '') === 'trips' && f.resource_id && tripById[f.resource_id]) {
          f.summary = tripById[f.resource_id];
        }
        if (String(f.resource_type || '') === 'hotels' && f.resource_id && hotelById[f.resource_id]) {
          f.summary = hotelById[f.resource_id];
        }
      });
    }

    state.fulfillments = filteredMerged;

    const shopIds = filteredMerged.filter((f) => f && f.__source === 'shop').map((f) => f.id).filter(Boolean);
    const serviceIds = filteredMerged.filter((f) => f && f.__source === 'service').map((f) => f.id).filter(Boolean);

    state.itemsByFulfillmentId = {};
    state.contactsByFulfillmentId = {};
    state.formSnapshotsByFulfillmentId = {};

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
  }

  function updateKpis() {
    const rows = filteredFulfillmentsForSelectedCategory();
    const pending = rows.filter((f) => String(f.status) === 'pending_acceptance').length;
    const awaiting = rows.filter((f) => String(f.status) === 'awaiting_payment').length;
    const accepted = rows.filter((f) => String(f.status) === 'accepted').length;
    const rejected = rows.filter((f) => String(f.status) === 'rejected').length;

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

  async function refreshPartnerAnalytics() {
    if (!state.sb || !state.selectedPartnerId) return;
    if (!els.partnerAnalyticsCard) return;
    if (String(state.selectedCategory || 'all') !== 'all') return;
    if (els.partnerAnalyticsCard.hidden) return;

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const hasShopFulfillments = (state.fulfillments || []).some((f) => f && String(f.__source || '') === 'shop');
    const canShop = Boolean(partner?.can_manage_shop && (partner?.shop_vendor_id || hasShopFulfillments));

    if (!state.fulfillments?.length) {
      try {
        await loadFulfillments();
      } catch (_e) {
      }
    }

    const rows = Array.isArray(state.fulfillments) ? state.fulfillments : [];

    const counts = {
      total: rows.length,
      pending: 0,
      awaiting: 0,
      accepted: 0,
    };

    const depositByFid = {};
    try {
      const { data, error } = await state.sb.rpc('partner_get_service_deposit_amounts', {
        p_partner_id: state.selectedPartnerId,
      });
      if (!error) {
        (data || []).forEach((r) => {
          const fid = r?.fulfillment_id;
          if (!fid) return;
          depositByFid[String(fid)] = toNum(r?.amount);
        });
      }
    } catch (_e) {
    }

    let invitedCount = 0;
    try {
      const { count, error } = await state.sb
        .from('referrals')
        .select('referred_id', { count: 'exact', head: true })
        .eq('referrer_id', state.user?.id || '')
        .limit(1);
      if (!error) invitedCount = Number(count || 0);
    } catch (_e) {
      invitedCount = 0;
    }

    let partnerEarnings = 0;

    rows.forEach((f) => {
      const st = String(f?.status || '').trim();
      if (st === 'pending_acceptance') counts.pending += 1;
      if (st === 'awaiting_payment') counts.awaiting += 1;
      if (st === 'accepted') counts.accepted += 1;
      if (st !== 'accepted') return;

      const src = String(f?.__source || 'shop');

      if (src === 'service') {
        const gross = String(f?.resource_type || '').toLowerCase() === 'cars'
          ? getCarsFulfillmentPricing(f).amount
          : toNum(f?.total_price);
        const deposit = toNum(depositByFid[String(f?.id)] || 0);
        const payout = Math.max(0, gross - deposit);
        partnerEarnings += payout;
        return;
      }

      const gross = toNum(f?.subtotal);
      const payout = toNum(f?.total_allocated);
      partnerEarnings += payout;
    });

    setText(els.partnerAnalOrdersTotal, String(counts.total));
    setText(els.partnerAnalOrdersPending, String(counts.pending));
    setText(els.partnerAnalOrdersAwaiting, String(counts.awaiting));
    setText(els.partnerAnalOrdersAccepted, String(counts.accepted));
    setText(els.partnerAnalPartnerEarnings, formatMoney(partnerEarnings, 'EUR'));
    setText(els.partnerAnalInvited, String(invitedCount || 0));

    if (els.partnerAnalHint) {
      els.partnerAnalHint.textContent = 'Partner earnings shown for accepted orders only.';
    }
  }

  async function callFulfillmentAction(fulfillmentId, action, reason) {
    const { data, error } = await state.sb.functions.invoke('partner-fulfillment-action', {
      body: { fulfillment_id: fulfillmentId, action, reason: reason || undefined },
    });
    if (error) {
      const msg = error.message || 'Request failed';
      throw new Error(msg);
    }
    return data;
  }

  async function callServiceFulfillmentAction(fulfillmentId, action, reason) {
    return callFulfillmentAction(fulfillmentId, action, reason);
  }

  function messageForFulfillmentAction(action, result) {
    const act = String(action || '').trim();
    const ok = Boolean(result && typeof result === 'object' && result.ok !== false);
    const skipped = Boolean(result && typeof result === 'object' && result.skipped);
    const reason = result && typeof result === 'object' ? String(result.reason || '').trim() : '';
    const nextStatus = result && typeof result === 'object' && result.data && typeof result.data === 'object'
      ? String(result.data.status || '').trim()
      : '';

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

  function renderFulfillmentsTable() {
    if (!els.fulfillmentsBody) return;

    const filtered = filteredFulfillmentsForSelectedCategory();

    if (!filtered.length) {
      const dbg = state.lastFulfillmentsDebug;
      const dbgHtml = dbg
        ? `<div class="small muted" style="margin-top: 6px;">Debug: shop ${Number(dbg.raw_shop || 0)}, service ${Number(dbg.raw_service || 0)}, closed ${Number(dbg.closed || 0)}, after_filters ${Number(dbg.filtered_total || 0)}</div>`
        : '';
      setHtml(els.fulfillmentsBody, `<tr><td colspan="6" class="muted" style="padding: 16px 8px;">No fulfillments found.${dbgHtml}</td></tr>`);
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

          let valueHtml = '';
          if (p.kind === 'email') {
            const s = String(value || '').trim();
            valueHtml = s ? `<a href="mailto:${encodeURIComponent(s)}">${escapeHtml(s)}</a>` : '<span class="muted">—</span>';
          } else if (p.kind === 'tel') {
            const s = String(value || '').trim();
            valueHtml = s ? `<a href="tel:${encodeURIComponent(s)}">${escapeHtml(s)}</a>` : '<span class="muted">—</span>';
          } else if (p.kind === 'pre') {
            valueHtml = rawText ? `<pre>${escapeHtml(rawText)}</pre>` : '<span class="muted">—</span>';
          } else {
            valueHtml = renderFormValue(value);
          }

          return `
            <div class="partner-details-kv-row">
              <div class="partner-details-label">${label}</div>
              <div class="partner-details-value">${valueHtml}</div>
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
      const detailsPayload = (f.details && typeof f.details === 'object') ? f.details : null;
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
        const pill = category ? String(category).toUpperCase() : '';
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
              usedKeys.add(variant);
              return detailsValue;
            }
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

      const customerSectionPairs = (() => {
        const pairs = (() => {
          if (category === 'cars') {
            return [
              { label: 'Name', value: contact?.customer_name ?? getField('full_name', 'customer_name') ?? null, key: 'customer_name' },
              { label: 'Email', value: contact?.customer_email ?? getField('email', 'customer_email') ?? null, kind: 'email', key: 'customer_email' },
              { label: 'Phone', value: contact?.customer_phone ?? getField('phone', 'customer_phone') ?? null, kind: 'tel', key: 'customer_phone' },
              { label: 'Country', value: getField('country') },
            ];
          }

          if (category === 'trips' || category === 'hotels') {
            return [
              { label: 'Name', value: contact?.customer_name ?? getField('customer_name', 'full_name') ?? null, key: 'customer_name' },
              { label: 'Email', value: contact?.customer_email ?? getField('customer_email', 'email') ?? null, kind: 'email', key: 'customer_email' },
              { label: 'Phone', value: contact?.customer_phone ?? getField('customer_phone', 'phone') ?? null, kind: 'tel', key: 'customer_phone' },
            ];
          }

          return [
            { label: 'Name', value: contact?.customer_name ?? getField('customer_name', 'full_name') ?? null, key: 'customer_name' },
            { label: 'Email', value: contact?.customer_email ?? getField('customer_email', 'email') ?? null, kind: 'email', key: 'customer_email' },
            { label: 'Phone', value: contact?.customer_phone ?? getField('customer_phone', 'phone') ?? null, kind: 'tel', key: 'customer_phone' },
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
        return [
          { label: 'Arrival date', value: getField('arrival_date') },
          { label: 'Departure date', value: getField('departure_date') },
          { label: 'Nights', value: getField('nights') },
          { label: 'Adults', value: getField('num_adults') },
          { label: 'Children', value: getField('num_children') },
        ];
      })();

      const tripsDetailsPairs = (() => {
        if (category !== 'trips') return [];
        return [
          { label: 'Trip date', value: getField('trip_date') },
          { label: 'Arrival date', value: getField('arrival_date') },
          { label: 'Departure date', value: getField('departure_date') },
          { label: 'Adults', value: getField('num_adults') },
          { label: 'Children', value: getField('num_children') },
        ];
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
        sectionHtml('Customer information', customerSectionPairs),
        category === 'shop' ? sectionHtml('Shipping', shippingSectionPairs) : '',
        category === 'shop' ? sectionHtml('Billing', billingSectionPairs) : '',
        category === 'cars' ? sectionHtml('Rental details', carsRentalPairs) : '',
        category === 'cars' ? sectionHtml('Pickup', carsPickupPairs) : '',
        category === 'cars' ? sectionHtml('Return', carsReturnPairs) : '',
        category === 'hotels' ? sectionHtml('Stay details', hotelsStayPairs) : '',
        category === 'trips' ? sectionHtml('Trip details', tripsDetailsPairs) : '',
        notesPairs.length ? sectionHtml('Notes', notesPairs) : '',
        additionalPairs.length ? sectionHtml('Additional information', additionalPairs) : '',
      ].filter(Boolean).join('');

      if (els.partnerDetailsBody) {
        els.partnerDetailsBody.setAttribute('data-category', category || '');
        els.partnerDetailsBody.innerHTML = html || '<div class="muted">No customer details available.</div>';
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

          if (String(f.resource_type || '') === 'trips') {
            const details = (f.details && typeof f.details === 'object') ? f.details : null;
            const preferred = details?.preferred_date || details?.preferredDate || details?.trip_date || details?.tripDate || null;
            const arrival = details?.arrival_date || details?.arrivalDate || null;
            const departure = details?.departure_date || details?.departureDate || null;
            const adults = details?.num_adults ?? details?.numAdults ?? null;
            const children = details?.num_children ?? details?.numChildren ?? null;

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

            const parts = [preferredHtml, stayHtml, participantsHtml].filter(Boolean).join('');
            return parts || '<span class="muted">—</span>';
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
            if (String(f.resource_type || '') === 'cars') {
              const pricing = getCarsFulfillmentPricing(f);
              const val = escapeHtml(formatMoney(pricing.amount, pricing.currency));
              const couponHint = pricing.hasCoupon
                ? `<div class="small" style="margin-top:4px; opacity:0.9;">Coupon ${escapeHtml(pricing.couponCode || 'applied')}</div>`
                : '';
              return `
                <div class="muted small">${pricing.hasCoupon ? 'Final Rental Total' : 'Suggested Total'}</div>
                <div class="small" style="margin-top:6px; padding:8px 10px; border-radius:10px; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#fff; font-weight:700; display:inline-block;">${val}</div>
                ${couponHint}
              `;
            }
            return f.total_price != null
              ? `<span class="small">${escapeHtml(formatMoney(f.total_price, f.currency || 'EUR'))}</span>`
              : '<span class="muted">—</span>';
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
          const hasDetails = Boolean(f.details && typeof f.details === 'object' && Object.keys(f.details).length);
          if (!hasContact && !hasSnapshot && !hasDetails) return '';
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

        return `
          <tr data-fulfillment-id="${escapeHtml(id)}">
            <td>
              <strong>${orderLabel}</strong>
              <div class="muted small">Created: ${escapeHtml(formatDate(f.created_at))}</div>
            </td>
            <td>
              ${statusBadge(f.status)}
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
            const reason = prompt('Provide a rejection reason (optional):') || '';
            if (!confirm('Are you sure you want to reject this fulfillment?')) return;
            btn.disabled = true;
            let result = null;
            if (source === 'service') {
              result = await callServiceFulfillmentAction(fulfillmentId, 'reject', reason);
            } else {
              result = await callFulfillmentAction(fulfillmentId, 'reject', reason);
            }
            const msg = messageForFulfillmentAction('reject', result);
            const tone = result && typeof result === 'object' && result.skipped ? 'info' : 'success';
            showToast(msg, tone);
          } else {
            if (!confirm('Accepting will request a customer deposit payment. Contact details will be revealed after payment confirmation. Continue?')) return;
            btn.disabled = true;
            let result = null;
            if (source === 'service') {
              result = await callServiceFulfillmentAction(fulfillmentId, 'accept');
            } else {
              result = await callFulfillmentAction(fulfillmentId, 'accept');
            }
            const msg = messageForFulfillmentAction('accept', result);
            const tone = result && typeof result === 'object' && result.skipped ? 'info' : 'success';
            showToast(msg, tone);
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
      updateKpis();
      renderFulfillmentsTable();
      if (!els.partnerAnalyticsCard?.hidden) {
        startAnalyticsRealtime();
        await refreshPartnerAnalytics();
      }
      if (String(state.selectedCategory || 'all') === 'all') {
        try {
          await refreshAffiliateSummaryCard();
        } catch (_e) {
        }
      }
      setText(els.status, `Loaded ${state.fulfillments.length} fulfillments.`);
    } catch (error) {
      console.error(error);
      setText(els.status, 'Failed to load fulfillments.');
      showWarning(`Failed to load fulfillments: ${error.message || 'Unknown error'}`);
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
        const preferredTypes = ['shop', 'cars', 'trips', 'hotels'];
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
      refreshFulfillments();
    } else {
      refreshCalendar();
    }
  }

  async function handlePartnerChange(nextPartnerId) {
    state.selectedPartnerId = nextPartnerId || null;
    if (state.selectedPartnerId) {
      setPersistedPartnerId(state.selectedPartnerId);
    }

    clearAvailabilitySelectionsAll();
    updateAvailabilitySelectionSummary();

    startBlocksRealtime();
    startAnalyticsRealtime();

    renderSuspendedInfo();

    syncResourceTypeOptions();

    updateSidebarCategoryVisibility();
    updateAffiliateSummaryCardVisibility();
    updateServiceSectionVisibility();

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

    setActiveTab(els.tabBtnCalendar?.classList.contains('is-active') ? 'calendar' : 'fulfillments');
  }

  async function bootstrapPortal() {
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

    if (!state.session || !state.user) {
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
      await loadMemberships();
    } catch (error) {
      console.error(error);
      showWarning(`Failed to load partner: ${error.message || 'Error'}`);
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
    ensureCalendarMonthInput();

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    if (partner && els.blockResourceType && els.blockResourceId) {
      if (els.blockResourceType.value === 'shop' && !els.blockResourceId.value && partner.shop_vendor_id) {
        els.blockResourceId.value = partner.shop_vendor_id;
      }
    }

    setActiveTab('fulfillments');
    setText(els.status, 'Ready.');

    try {
      await refreshAffiliateSummaryCard();
    } catch (_e) {
    }

    try {
      await loadPartnerPushNotificationSettings();
    } catch (_e) {
    }
  }

  function attachEventListeners() {
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
    els.partnerNavCalendar?.addEventListener('click', () => navToCalendar());
    els.partnerNavProfile?.addEventListener('click', () => navToProfile());
    els.partnerNavReferrals?.addEventListener('click', () => navToReferrals());

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
      if (!link || link.toLowerCase().includes('set your username')) {
        showToast('Set your username to enable referral link.', 'error');
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
        showToast('Set your username to enable referral code.', 'error');
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
      state.sb.auth.onAuthStateChange((_event, session) => {
        state.session = session;
        state.user = session?.user || null;
        if (!session) {
          stopBlocksRealtime();
          stopAnalyticsRealtime();
        }
        bootstrapPortal();
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

    els.tabFulfillments = $('partnerTabFulfillments');
    els.tabCalendar = $('partnerTabCalendar');
    els.tabBtnFulfillments = $('partnerTabBtnFulfillments');
    els.tabBtnCalendar = $('partnerTabBtnCalendar');

    els.fulfillmentsHint = $('fulfillmentsHint');
    els.fulfillmentsBody = $('fulfillmentsTableBody');
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
    els.partnerNavCalendar = $('partnerNavCalendar');
    els.partnerNavProfile = $('partnerNavProfile');
    els.partnerNavReferrals = $('partnerNavReferrals');
    els.partnerUserName = $('partnerUserName');
    els.partnerBreadcrumb = $('partnerBreadcrumb');

    els.partnerPortalView = $('partnerPortalView');
    els.partnerProfileView = $('partnerProfileView');
    els.partnerReferralsView = $('partnerReferralsView');

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
    els.partnerAffiliateSummaryUnpaid = $('partnerAffiliateSummaryUnpaid');
    els.partnerAffiliateSummaryPending = $('partnerAffiliateSummaryPending');
    els.partnerAffiliateSummaryPaid = $('partnerAffiliateSummaryPaid');
    els.partnerAffiliateSummaryThreshold = $('partnerAffiliateSummaryThreshold');
    els.partnerAffiliateSummaryProgressText = $('partnerAffiliateSummaryProgressText');
    els.partnerAffiliateSummaryProgressBar = $('partnerAffiliateSummaryProgressBar');
    els.btnPartnerAffiliateSummaryCashout = $('btnPartnerAffiliateSummaryCashout');
    els.partnerAffiliateSummaryCashoutHint = $('partnerAffiliateSummaryCashoutHint');

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
