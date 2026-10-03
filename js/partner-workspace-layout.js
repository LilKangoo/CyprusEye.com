/* Layout only. Move original controls; never duplicate a form or change permission flags. */
(() => {
  const $ = (id) => document.getElementById(id);
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  function tabs(parent, entries, title, asSelect = false) {
    const shell = make("section", "partner-layout-tabs partner-card");
    shell.append(make("h2", "", title));
    const controls = make("div", "partner-layout-tab-buttons");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", title);
    shell.append(controls);
    let active = 0;
    let selection;
    const pairs = entries
      .filter((x) => x[1])
      .map(([label, panel], i) => {
        const button = make("button", "btn-sm", label);
        button.type = "button";
        controls.append(button);
        panel.classList.add("partner-layout-tab-panel");
        shell.append(panel);
        button.addEventListener("click", () => {
          active = i;
          sync();
        });
        return { button, panel };
      });
    const sync = () => {
      if (!pairs[active] || pairs[active].panel.hidden)
        active = pairs.findIndex((p) => !p.panel.hidden);
      pairs.forEach(({ button, panel }, i) => {
        button.hidden = panel.hidden;
        if (selection) {
          selection.options[i].hidden = panel.hidden;
          selection.options[i].disabled = panel.hidden;
        }
        button.setAttribute("aria-pressed", String(i === active));
        panel.classList.toggle("is-current", i === active);
      });
      if (selection) selection.value = String(active);
      shell.hidden = pairs.every((p) => p.panel.hidden);
    };
    pairs.forEach(({ panel }) =>
      new MutationObserver(sync).observe(panel, {
        attributes: true,
        attributeFilter: ["hidden"],
      }),
    );
    if (asSelect) {
      const label = make("label", "partner-report-select", title);
      const select = make("select");
      selection = select;
      pairs.forEach(({ button }, i) => {
        const option = make("option", "", button.textContent);
        option.value = String(i);
        select.append(option);
      });
      select.addEventListener("change", () => {
        active = Number(select.value);
        sync();
      });
      label.append(select);
      shell.insertBefore(label, controls);
      controls.classList.add("partner-visually-hidden");
    }
    parent.append(shell);
    sync();
    return shell;
  }
  function initQrViewer() {
    const canvas = $("partnerReferralQrCanvas");
    const visual = canvas?.parentElement;
    if (!canvas || !visual) return;
    const trigger = make("button", "partner-qr-trigger");
    trigger.type = "button";
    trigger.setAttribute("aria-labelledby", "btnPartnerEnlargeQr");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "partnerQrFullscreen");
    canvas.before(trigger);
    trigger.append(canvas);
    const dialog = make("dialog", "partner-qr-dialog");
    dialog.id = "partnerQrFullscreen";
    dialog.setAttribute("aria-labelledby", "partnerQrFullscreenTitle");
    const header = make("div", "partner-qr-dialog-header");
    const title = make("h2", "", "Referral QR code");
    title.id = "partnerQrFullscreenTitle";
    const close = make("button", "btn-sm", "Close");
    close.type = "button";
    header.append(title, close);
    const stage = make("div", "partner-qr-dialog-stage");
    dialog.append(header, stage);
    document.body.append(dialog);
    const expand = make("button", "btn-sm", "Enlarge QR code");
    expand.id = "btnPartnerEnlargeQr";
    expand.type = "button";
    expand.setAttribute("aria-haspopup", "dialog");
    expand.setAttribute("aria-controls", dialog.id);
    $("partnerReferralQrCard")
      ?.querySelector(".partner-referral-qr-card__actions")
      ?.append(expand);
    let opener;
    const open = (event) => {
      if (dialog.open) return;
      opener = event.currentTarget;
      stage.append(canvas);
      document.body.classList.add("partner-qr-open");
      dialog.showModal();
      close.focus();
    };
    trigger.addEventListener("click", open);
    expand.addEventListener("click", open);
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target === stage) dialog.close();
    });
    dialog.addEventListener("close", () => {
      trigger.append(canvas);
      document.body.classList.remove("partner-qr-open");
      opener?.focus({ preventScroll: true });
    });
  }
  function init() {
    document.body.classList.add("partner-workspace-complete");
    initQrViewer();
    // Availability: calendar and selectable photo resources on the left, original block form on the right.
    const calendar = $("partnerTabCalendar");
    if (calendar) {
      const layout = make("div", "partner-availability-layout");
      const left = make("section", "partner-availability-main");
      const right = make("section", "partner-availability-editor partner-card");
      right.append(make("h2", "", "Availability block"));
      [...calendar.children].forEach((el) => {
        if (
          el === $("partnerBlockForm") ||
          el.matches(".admin-table-container")
        )
          right.append(el);
        else left.append(el);
      });
      layout.append(left, right);
      calendar.append(layout);
      const resource = $("blockResourceId")?.parentElement;
      if (resource) {
        resource.classList.add("partner-resource-selector");
        $("partnerResourcePanels")?.before(resource);
      }
      const update = () => {
        const availability = !calendar.hidden;
        const portal = $("partnerPortalView");
        portal?.classList.toggle("is-availability", availability);
        const title = portal?.querySelector("h1");
        const desired = availability ? "Availability" : "Reservations";
        if (title && title.dataset.viewTitle !== desired) {
          title.dataset.viewTitle = desired;
          title.textContent = desired;
        }
      };
      new MutationObserver(update).observe(calendar, {
        attributes: true,
        attributeFilter: ["hidden"],
      });
      update();
    }
    // Analytics: one chart first, personal KPI selection second, one selectable report below.
    const analytics = $("partnerAnalyticsView");
    const chart = $("partnerAnalyticsLiveChartCard");
    const kpis = analytics?.querySelector(".partner-analytics-card");
    if (analytics && chart && kpis) {
      kpis.before(chart);
      const filters = kpis.querySelector(".partner-analytics-controls");
      const meta = kpis.querySelector(".partner-analytics-meta");
      if (filters) chart.prepend(filters);
      if (meta) filters?.after(meta);
      const metrics = chart.querySelector('[aria-label="Live trend metric"]');
      const revenue = chart.querySelector(
        '[data-partner-chart-view="revenue"]',
      );
      const response = chart.querySelector(
        '[data-partner-chart-view="response"]',
      );
      if (metrics && response) {
        chart.querySelector(".partner-chart-view-switch").before(metrics);
        metrics.classList.add("partner-unified-metrics");
        metrics.append(response);
        metrics
          .querySelectorAll("[data-live-trend-metric]")
          .forEach((b) => b.addEventListener("click", () => revenue?.click()));
        const sync = () => {
          const showing = response.getAttribute("aria-pressed") === "true";
          metrics.classList.toggle("showing-response", showing);
        };
        new MutationObserver(sync).observe(response, {
          attributes: true,
          attributeFilter: ["aria-pressed"],
        });
        sync();
      }
      const metricHead = make("div", "partner-section-titlebar");
      metricHead.append(make("h2", "", "My metrics"));
      const customize = make("button", "btn-sm", "Customize");
      customize.type = "button";
      customize.setAttribute("aria-expanded", "false");
      const custom = kpis.querySelector(".partner-metrics-custom");
      if (custom) custom.hidden = true;
      customize.addEventListener("click", () => {
        if (custom) {
          custom.hidden = !custom.hidden;
          customize.setAttribute("aria-expanded", String(!custom.hidden));
        }
      });
      metricHead.append(customize);
      kpis.prepend(metricHead);
      const period = $("partnerAnalyticsPeriodType");
      if (period) {
        period.hidden = false;
        period.removeAttribute("aria-hidden");
        period.removeAttribute("tabindex");
        filters
          .querySelector(".partner-period-switch")
          ?.classList.add("partner-visually-hidden");
      }
      const chartType = make("select");
      chartType.setAttribute("aria-label", "Chart type");
      [
        ["bar", "Bars"],
        ["line", "Line"],
      ].forEach(([value, label]) => {
        const o = make("option", "", label);
        o.value = value;
        chartType.append(o);
      });
      chartType.addEventListener("change", () =>
        chart
          .querySelector(`[data-live-trend-type="${chartType.value}"]`)
          ?.click(),
      );
      const oldType = chart.querySelector(
        '[aria-label="Live trend chart type"]',
      );
      if (oldType) {
        oldType.before(chartType);
        oldType.classList.add("partner-visually-hidden");
      }

      kpis.querySelectorAll(".partner-analytics-kpi-grid").forEach((g, i) => {
        g.hidden = i > 0;
      });
      kpis
        .querySelectorAll(".partner-metrics-custom button")
        .forEach((b, i) => b.setAttribute("aria-pressed", String(i === 0)));
      tabs(
        analytics,
        [
          ["By category", $("partnerAnalyticsByTypeCard")],
          ["Time series", $("partnerAnalyticsTimeseriesCard")],
          ["Top services", $("partnerAnalyticsTopOffersCard")],
          ["Top products", $("partnerAnalyticsTopProductsCard")],
        ],
        "Detailed report",
        true,
      );
    }
    // Profile: independent existing forms grouped into account, security and payout cards.
    const profile = $("partnerProfileView");
    const account = profile?.querySelector("section.partner-card");
    if (profile && account) {
      const grid = make("div", "partner-profile-layout");
      account.before(grid);
      grid.append(account);
      const security = make("section", "partner-card");
      security.append(make("h2", "", "Security"));
      const payout = make("section", "partner-card");
      payout.append(make("h2", "", "Payout details"));
      const password = $("partnerProfilePasswordForm");
      if (password) security.append(password);
      const payoutForm = $("partnerProfilePayoutForm");
      if (payoutForm) payout.append(payoutForm);
      grid.append(security);
      if (payoutForm) grid.append(payout);
      [...account.children]
        .filter(
          (e) =>
            e.tagName === "DIV" && !e.textContent.trim() && !e.children.length,
        )
        .forEach((e) => e.remove());
    }
    // Referrals: financial overview, switchable history, then the network and compact copy controls.
    const referrals = $("partnerReferralsView");
    const affiliate = $("partnerAffiliateCard");
    if (referrals && affiliate) {
      const links = referrals.querySelector(":scope > section");
      const tree = $("partnerReferralTreeContainer")?.closest("section");
      if (links && links !== affiliate) {
        links.classList.add("partner-referral-links-compact");
        if (tree) tree.before(links);
      }
      const ledger = affiliate.querySelector(".admin-table-container");
      if (ledger) {
        const guardedLedger = make("section", "partner-commission-history");
        guardedLedger.append(ledger);
        const syncPermission = () => {
          guardedLedger.hidden = affiliate.hidden;
        };
        new MutationObserver(syncPermission).observe(affiliate, {
          attributes: true,
          attributeFilter: ["hidden"],
        });
        syncPermission();
        const report = tabs(
          referrals,
          [
            ["Commission history", guardedLedger],
            ["Referral orders", $("partnerReferralOrdersCard")],
          ],
          "Referral activity",
        );
        affiliate.after(report);
      }
      if (tree) referrals.append(tree);
      [...referrals.children]
        .filter(
          (e) =>
            e.tagName === "DIV" && !e.textContent.trim() && !e.children.length,
        )
        .forEach((e) => e.remove());
    }
    // QR size, category shortcuts, and offer cards keep their original copy/preview handlers.
    const links = $("partnerLinksDiscountsView");
    if (links) {
      const shell = links.querySelector(".partner-links-shell");
      const qr = $("partnerReferralQrCard");
      if (qr && shell) {
        shell.before(qr);
        qr.classList.add("partner-card");
      }
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
