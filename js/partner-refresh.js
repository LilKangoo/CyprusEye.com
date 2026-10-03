/* Presentation enhancements. Existing nodes, IDs, listeners and permission gates are retained. */
(() => {
  const init = () => {
    const title = document.querySelector(".admin-title");
    if (title) {
      title.querySelector("svg")?.remove();
      const logo = new Image(38, 38);
      logo.src = "/assets/cyprus_logo-128.png";
      logo.alt = "CyprusEye";
      title.prepend(logo);
    }
    const summary = document.getElementById("partnerReferralSummary");
    const input = document.getElementById("partnerReferralLinkSummary");
    if (summary && input) {
      const row = summary.firstElementChild;
      row?.classList.add("partner-referral-compact");
      input.parentElement.hidden = true;
      const old = document.getElementById("btnPartnerCopyReferralLinkSummary");
      if (old) old.parentElement.hidden = true;
      const controls = document.createElement("div");
      controls.className = "partner-copy-languages";
      const status = document.createElement("span");
      status.className = "muted small partner-copy-status";
      status.setAttribute("role", "status");
      for (const [lang, label] of [
        ["pl", "🇵🇱 PL"],
        ["en", "🇬🇧 EN"],
        ["he", "🇮🇱 HE"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-sm";
        button.append(document.createTextNode(label + " · "));
        const text = document.createElement("span");
        text.textContent = "Copy link";
        button.append(text);
        button.addEventListener("click", async () => {
          if (!input.value) {
            status.textContent = "Referral link is not available yet.";
            return;
          }
          try {
            const url = new URL(input.value);
            url.searchParams.set("lang", lang);
            await navigator.clipboard.writeText(url.toString());
            status.textContent = "Link copied";
          } catch {
            status.textContent = "Could not copy the link. Try again.";
          }
        });
        controls.appendChild(button);
      }
      row?.prepend(controls);
      const qr = document.createElement("button");
      qr.type = "button";
      qr.className = "btn-sm";
      qr.textContent = "QR";
      qr.addEventListener("click", () => {
        document.getElementById("btnPartnerOpenLinksDiscountsSummary")?.click();
        document
          .getElementById("partnerReferralQrCard")
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      row?.append(qr, status);
      const earnings = document.getElementById("partnerAffiliateSummaryCard");
      if (earnings) summary.append(earnings);
    }

    const workspace = document.getElementById("partnerPortalApp");
    const partnerToolbar = document.querySelector(
      "#partnerServicesCard > .partner-toolbar",
    );
    if (workspace && partnerToolbar) {
      partnerToolbar.classList.add("partner-workspace-switch");
      workspace.prepend(partnerToolbar);
    }

    // Match the approved reservations layout while retaining the original controls/listeners.
    const portal = document.getElementById("partnerPortalView");
    const heading = portal?.querySelector("h1");
    if (heading) heading.textContent = "Reservations";
    const intro = portal?.querySelector(":scope > p");
    if (intro)
      intro.textContent =
        "Bookings, referrals and your daily actions in one place.";
    if (summary) {
      const head = document.createElement("div");
      head.className = "partner-referral-heading";
      const label = document.createElement("strong");
      label.textContent = "Your referral link & code";
      head.append(label);
      const invited = summary.querySelector(
        "#partnerReferralCountSummary",
      )?.parentElement;
      if (invited) head.append(invited);
      summary.prepend(head);
      const code = document.getElementById("partnerReferralCodeSummary");
      const copy = document.getElementById("btnPartnerCopyReferralCodeSummary");
      if (code && copy) {
        const group = code.parentElement;
        group.classList.add("partner-code-inline");
        group.append(copy);
      }
    }

    const searchBar = document.querySelector(".partner-search-bar");
    const filter = document.querySelector(".partner-orders-filter-panel");
    const statusButtons = [
      ...document.querySelectorAll("[data-orders-status-filter]"),
    ];
    if (searchBar && filter && statusButtons.length) {
      filter.before(searchBar);
      const label = document.createElement("label");
      label.append(document.createTextNode("Status"));
      const select = document.createElement("select");
      select.id = "partnerOrderStatus";
      statusButtons.forEach((button) => {
        const option = document.createElement("option");
        option.value = button.dataset.ordersStatusFilter;
        option.textContent = button.textContent;
        select.append(option);
      });
      select.addEventListener("change", () =>
        statusButtons
          .find((b) => b.dataset.ordersStatusFilter === select.value)
          ?.click(),
      );
      label.append(select);
      searchBar.children[1]?.before(label);
      const syncStatus = () => {
        select.value =
          statusButtons.find(
            (b) =>
              b.getAttribute("aria-pressed") === "true" ||
              b.classList.contains("is-active"),
          )?.dataset.ordersStatusFilter || "all";
      };
      new MutationObserver(syncStatus).observe(filter, {
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-pressed", "class"],
      });
      syncStatus();
      const chips = document.createElement("div");
      chips.className = "partner-order-category-chips";
      const nav = [
        ...document.querySelectorAll("#partnerNavAll, [data-partner-category]"),
      ];
      const pairs = nav.map((source) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-sm";
        button.textContent =
          source.id === "partnerNavAll"
            ? "All"
            : source.querySelector("span")?.textContent || source.textContent;
        button.addEventListener("click", () => source.click());
        chips.append(button);
        return { source, button };
      });
      const syncCategories = () =>
        pairs.forEach(({ source, button }) => {
          button.hidden = source.hidden;
          button.setAttribute(
            "aria-pressed",
            String(source.classList.contains("active")),
          );
        });
      new MutationObserver(syncCategories).observe(
        document.getElementById("partnerSidebarNav"),
        {
          subtree: true,
          attributes: true,
          attributeFilter: ["hidden", "class"],
        },
      );
      syncCategories();
      const reset = document.getElementById("btnPartnerOrdersClearFilters");
      if (reset) chips.append(reset);
      searchBar.after(chips);
      const hint = document.getElementById("partnerOrdersFilterHint");
      if (hint) chips.after(hint);
    }

    const resources = document.getElementById("partnerResourcePanels");
    const grid = document.getElementById("partnerCalendarMonthGrid");
    if (resources && grid) grid.after(resources);
    const orders = document.getElementById("partnerTabFulfillments");
    const calendar = orders?.querySelector(".partner-orders-calendar-card");
    if (calendar) {
      orders.append(calendar);
      const bar = document.createElement("div");
      bar.className = "partner-orders-titlebar";
      const title = document.createElement("h2");
      title.textContent = "Your orders";
      const find = document.createElement("button");
      find.type = "button";
      find.className = "btn-sm";
      find.textContent = "Find in calendar";
      find.addEventListener("click", () => {
        calendar.scrollIntoView({ block: "start", behavior: "smooth" });
        document
          .getElementById("partnerOrdersCalendarMonthInput")
          ?.focus({ preventScroll: true });
      });
      bar.append(title, find);
      orders.prepend(bar);
    }

    const live = document.getElementById("partnerAnalyticsLiveChartCard");
    const response = document.getElementById(
      "partnerAnalyticsResponseChartCard",
    );
    if (live && response) {
      live.append(response);
      response.hidden = true;
      document.querySelectorAll("[data-partner-chart-view]").forEach((button) =>
        button.addEventListener("click", () => {
          const showResponse = button.dataset.partnerChartView === "response";
          response.hidden = !showResponse;
          document.getElementById("partnerAnalyticsLiveChart").hidden =
            showResponse;
          live.querySelector(".partner-analytics-chart-controls").hidden =
            showResponse;
          document
            .querySelectorAll("[data-partner-chart-view]")
            .forEach((b) =>
              b.setAttribute("aria-pressed", String(b === button)),
            );
        }),
      );
    }
    const analytics = document.querySelector(
      "#partnerAnalyticsView .partner-analytics-card",
    );
    if (analytics) {
      const custom = document.createElement("div");
      custom.className = "partner-metrics-custom";
      const label = document.createElement("span");
      label.textContent = "Show statistics";
      custom.append(label);
      const groups = analytics.querySelectorAll(".partner-analytics-kpi-grid");
      ["Revenue & orders", "Order status", "Response time"].forEach(
        (label, i) => {
          if (!groups[i]) return;
          const button = document.createElement("button");
          button.className = "btn-sm";
          button.type = "button";
          button.textContent = label;
          button.setAttribute("aria-pressed", "true");
          button.addEventListener("click", () => {
            groups[i].hidden = !groups[i].hidden;
            button.setAttribute("aria-pressed", String(!groups[i].hidden));
          });
          custom.append(button);
        },
      );
      groups[0]?.before(custom);
    }
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
