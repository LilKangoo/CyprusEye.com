/* Shared shell controller. Auth, cart, profile and page content keep their existing owners. */
(() => {
  "use strict";
  const shell = document.querySelector("[data-site-navigation]");
  if (!shell) return;
  const menu = document.getElementById("ce-site-menu");
  const backdrop = document.querySelector(".ce-menu-backdrop");
  const desktop = matchMedia("(min-width:1280px)");
  let opener = null;
  let inertRoots = [];
  const language = () =>
    String(document.documentElement.lang || "en").split("-")[0];
  let campaignTranslationTicket = 0;
  const campaignPacks = new Map();
  async function translateCampaignShell() {
    if (!shell.querySelector("[data-ce-campaign-language]")) return;
    const lang = language(),
      ticket = ++campaignTranslationTicket;
    try {
      if (!campaignPacks.has(lang)) {
        const response = await fetch("/translations/" + lang + ".json?v=20261001-navigation");
        if (!response.ok) return;
        campaignPacks.set(lang, await response.json());
      }
      if (ticket !== campaignTranslationTicket) return;
      const pack = campaignPacks.get(lang);
      const value = (key) =>
        pack[key] ?? key.split(".").reduce((v, k) => v?.[k], pack);
      for (const root of [shell, document.getElementById("sosModal")]) {
        if (!root) continue;
        root.querySelectorAll("[data-i18n]").forEach((el) => {
          if (
            el.closest(".brand-title") ||
            el.matches(
              "[data-compact-user-name],.profile-name,[data-compact-user-status],.profile-status",
            )
          )
            return;
          const v = value(el.dataset.i18n);
          if (typeof v === "string") el.textContent = v;
          else if (v && typeof v === "object") {
            if (v.text) el.textContent = v.text;
            else if (v.html) el.innerHTML = v.html;
            for (const [key, val] of Object.entries(v.attributes || {}))
              el.setAttribute(key, val);
          }
        });
        root.querySelectorAll("[data-i18n-attrs]").forEach((el) => {
          for (const pair of el.dataset.i18nAttrs.split(";")) {
            const [attr, key] = pair.split(":");
            const v = value(key || "");
            if (typeof v === "string") el.setAttribute(attr, v);
          }
        });
      }
    } catch {
      /* Existing campaign content and navigation remain usable while offline. */
    }
  }
  const t = (key) =>
    window.CE_NAV_LABELS?.[key]?.[language()] ||
    window.CE_NAV_LABELS?.[key]?.en ||
    key;
  function sync() {
    const tourTarget = desktop.matches
      ? menu
      : document.querySelector(
          matchMedia("(max-width:767px)").matches
            ? ".ce-bottom-nav"
            : ".ce-service-strip",
        );
    document
      .querySelectorAll('[data-tour-target="tabs-navigation"]')
      .forEach((el) => el.removeAttribute("data-tour-target"));
    tourTarget?.setAttribute("data-tour-target", "tabs-navigation");

    const sosLabels = {
      "Telefon alarmowy": "hotline",
      Recepcja: "reception",
      Adres: "address",
      "E-mail": "email",
    };
    document.querySelectorAll("#sosModal strong").forEach((el) => {
      const key = sosLabels[el.textContent.trim()];
      if (key) el.dataset.ceLabel = key;
    });
    shell
      .querySelector(".nav-modern__brand-link")
      ?.setAttribute("aria-label", t("homeLabel"));
    shell
      .querySelectorAll("#headerUserAvatar,[data-compact-user-avatar]")
      .forEach((el) => (el.alt = t("avatar")));

    document.querySelectorAll("[data-ce-label]").forEach((el) => {
      el.textContent = t(el.dataset.ceLabel);
    });
    shell
      .querySelector("[data-compact-profile-close]")
      ?.setAttribute("aria-label", t("closePanel"));
    document
      .querySelectorAll("[data-ce-close]")
      .forEach((el) => el.setAttribute("aria-label", t("close")));
    for (const el of [menu, document.querySelector(".ce-bottom-nav")])
      el?.setAttribute("aria-label", t("menu"));
    document
      .querySelector(".ce-service-strip")
      ?.setAttribute("aria-label", t("services"));
    if (shell.querySelector("[data-ce-campaign-language]")) {
      void translateCampaignShell();
      shell.querySelectorAll('[data-auth-target="login"]').forEach((el) => {
        el.textContent = t("login");
        el.setAttribute("aria-label", t("login"));
      });
      shell
        .querySelectorAll('[data-i18n="header.profileLabel"]')
        .forEach((el) => {
          el.textContent = t("account");
        });
      shell.querySelectorAll('[data-auth="logout"]').forEach((el) => {
        el.textContent = t("logout");
        el.setAttribute("aria-label", t("logout"));
      });
    }
    const logged = !!window.CE_STATE?.session?.user;
    const account = document.querySelector("[data-ce-account-label]");
    if (account) account.textContent = t(logged ? "account" : "login");
    const route =
      document.body.dataset.seoPage ||
      location.pathname.replace(/^\/|\.html$|\/$/g, "");
    const aliases = {
      home: "map",
      index: "map",
      "": "map",
      trip: "trips",
      hotel: "hotels",
      car: "cars",
      carrental: "cars",
      plan: "planner",
      "blog-post": "blog",
      account: "account",
      kupon: "coupon",
    };
    const active = document.body.dataset.cePage ?? (aliases[route] || route);
    document.querySelectorAll("[data-ce-route]").forEach((el) => {
      if (el.dataset.ceRoute === active)
        el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    // Existing localization policy owns which languages/links are public on standard pages.
    if (window.CELanguage?.buildLocalizedUrl) {
      document
        .querySelectorAll(
          ".ce-site-menu a,.ce-bottom-nav a,.ce-service-strip a",
        )
        .forEach((a) => {
          a.href =
            window.CELanguage.buildLocalizedUrl(a.href, language(), {
              absolute: true,
            }) || a.href;
        });
    } else {
      document
        .querySelectorAll(
          ".ce-site-menu a,.ce-bottom-nav a,.ce-service-strip a",
        )
        .forEach((a) => {
          const u = new URL(a.href);
          u.searchParams.set("lang", language() === "he" ? "en" : language());
          a.href = u.href;
        });
    }
  }
  function close(restore = true) {
    document.body.classList.remove("ce-menu-open");
    backdrop.hidden = true;
    menu.removeAttribute("role");
    menu.removeAttribute("aria-modal");
    inertRoots.forEach((el) => {
      el.inert = false;
    });
    inertRoots = [];
    document
      .querySelectorAll("[data-ce-menu]")
      .forEach((el) => el.setAttribute("aria-expanded", "false"));
    if (restore && opener?.isConnected) opener.focus();
    opener = null;
  }
  function open(button) {
    opener = button;
    document.body.classList.add("ce-menu-open");
    backdrop.hidden = false;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-modal", "true");
    inertRoots = [
      ...document.querySelectorAll(
        "main,body>footer,.ce-site-header,.ce-service-strip,.ce-bottom-nav",
      ),
    ].filter((el) => !el.inert);
    inertRoots.forEach((el) => {
      el.inert = true;
    });
    document
      .querySelectorAll("[data-ce-menu]")
      .forEach((el) => el.setAttribute("aria-expanded", "true"));
    menu
      .querySelector(
        button.hasAttribute("data-ce-services")
          ? '[data-ce-group="book"] a'
          : "[data-ce-close]",
      )
      ?.focus();
  }
  document
    .querySelectorAll("[data-ce-menu]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        document.body.classList.contains("ce-menu-open") ? close() : open(btn),
      ),
    );
  document
    .querySelectorAll("[data-ce-close]")
    .forEach((btn) => btn.addEventListener("click", () => close()));
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) close(false);
  });
  document.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("ce-menu-open") || desktop.matches)
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key === "Tab") {
      const nodes = [...menu.querySelectorAll("a,button")].filter(
        (el) => !el.hidden && el.getClientRects().length,
      );
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
        event.preventDefault();
        nodes[0]?.focus();
      }
    }
  });
  document
    .querySelector("[data-ce-account]")
    ?.addEventListener("click", (event) => {
      event.stopPropagation();
      close(false);
      if (window.CE_STATE?.session?.user) {
        shell.querySelector("[data-compact-profile-trigger]")?.click();
      } else if (typeof window.openAuthModal === "function")
        window.openAuthModal("login");
      else if (shell.querySelector("[data-open-auth]"))
        shell.querySelector("[data-open-auth]").click();
      else
        location.href =
          "/auth/?returnTo=" +
          encodeURIComponent(
            location.pathname + location.search + location.hash,
          );
    });
  document.querySelector("[data-ce-cart]")?.addEventListener("click", () => {
    close(false);
    document.getElementById("btnOpenCart")?.click();
  });
  let panel = null,
    panelKind = "",
    panelRequest = 0,
    panelOpener = null;
  function closePanel() {
    panelRequest++;
    panel?.close();
    panelOpener?.focus();
  }
  async function showPanel(kind, trigger) {
    close(false);
    const uid = window.CE_STATE?.session?.user?.id;
    if (!uid) {
      document.querySelector("[data-ce-account]")?.click();
      return;
    }
    shell.querySelector("[data-compact-profile-close]")?.click();
    panelOpener = trigger;
    panelKind = kind;
    if (!panel) {
      panel = document.createElement("dialog");
      panel.className = "ce-data-dialog";
      panel.setAttribute("aria-labelledby", "ce-data-heading");
      panel.innerHTML =
        '<div class="ce-panel-head"><h2 id="ce-data-heading"></h2><button type="button" data-ce-panel-close>×</button></div><div data-ce-panel-content role="status" aria-live="polite"></div>';
      document.body.append(panel);
      panel
        .querySelector("[data-ce-panel-close]")
        .addEventListener("click", closePanel);
      panel.addEventListener("cancel", () => {
        panelRequest++;
      });
      panel.addEventListener("click", (e) => {
        if (e.target === panel) {
          const r = panel.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            closePanel();
        }
      });
    }
    panel.querySelector("h2").textContent = t(kind);
    panel
      .querySelector("[data-ce-panel-close]")
      .setAttribute("aria-label", t("closePanel"));
    const content = panel.querySelector("[data-ce-panel-content]");
    content.textContent = t("loading");
    if (!panel.open) panel.showModal();
    const request = ++panelRequest;
    try {
      const sb =
        typeof window.getSupabase === "function" ? window.getSupabase() : null;
      if (!sb) throw Error("Session provider unavailable");
      const api = await import("/js/site-navigation-data.js?v=20261001saved1");
      const rows =
        kind === "saved"
          ? await api.loadSaved(sb, uid, language())
          : await api.loadNotifications(sb, uid, language(), t);
      if (
        request !== panelRequest ||
        window.CE_STATE?.session?.user?.id !== uid
      )
        return;
      content.replaceChildren();
      if (!rows.length) {
        content.textContent = t(
          kind === "saved" ? "emptySaved" : "emptyNotifications",
        );
        return;
      }
      const list = document.createElement("ul");
      for (const row of rows) {
        const li = document.createElement("li"),
          a = document.createElement("a");
        a.textContent = row.title || t(({ car: "cars", trip: "trips", hotel: "hotels", recommendation: "recommendations", poi: "map" })[row.type] || "saved");
        a.href =
          window.CELanguage?.buildLocalizedUrl(row.href, language()) ||
          row.href;
        if (kind === "saved" && row.type === "poi") {
          a.addEventListener("click", (event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            const homeMap = window.CE_HOME_MAP;
            if (!homeMap?.ready || typeof homeMap.openPoi !== "function") return;
            const target = new URL(a.href, window.location.href);
            const poiId = target.searchParams.get("poi");
            if (!poiId) return;
            event.preventDefault();
            closePanel();
            homeMap.openPoi(poiId);
            if (window.location.href !== target.href) window.history.pushState(null, "", target.href);
          });
        }
        if (row.unread) a.dataset.unread = "true";
        if (row.detail) {
          const small = document.createElement("small");
          small.textContent = row.detail;
          a.append(small);
        }
        li.append(a);
        list.append(li);
      }
      content.append(list);
    } catch {
      if (request !== panelRequest) return;
      content.textContent = t("loadError");
      const retry = document.createElement("button");
      retry.textContent = t("retry");
      retry.addEventListener("click", () => showPanel(kind, trigger));
      content.append(document.createElement("br"), retry);
    }
  }
  document.querySelectorAll("[data-ce-panel]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showPanel(btn.dataset.cePanel, btn);
    }),
  );
  document.addEventListener("ce-auth:state", () => {
    if (panel?.open) {
      closePanel();
      panel.querySelector("[data-ce-panel-content]").replaceChildren();
    }
  });
  document.addEventListener("wakacjecypr:languagechange", () => {
    if (panel?.open) showPanel(panelKind, panelOpener);
  });
  shell
    .querySelector("[data-compact-profile-close]")
    ?.addEventListener("click", () => {
      if (matchMedia("(max-width:767px)").matches)
        document.querySelector("[data-ce-account]")?.focus();
    });
  desktop.addEventListener("change", () => {
    close(false);
    sync();
  });
  matchMedia("(max-width:767px)").addEventListener("change", sync);
  document.addEventListener("wakacjecypr:languagechange", sync);
  document.addEventListener("ce-auth:state", sync);
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  // Pages with their own translation controller keep it; only standalone legacy/account pills reload.
  if (
    !document.querySelector(
      'script[src*="/i18n.js"],script[src^="js/i18n.js"]',
    ) &&
    !shell.querySelector("[data-special-offer-lang]")
  ) {
    const lang = new URL(location.href).searchParams.get("lang") || "pl";
    document.documentElement.lang = ["pl", "en"].includes(lang) ? lang : "en";
    document.documentElement.dir = "ltr";
    shell.querySelectorAll("[data-language-pill]").forEach((btn) => {
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.languagePill === language()),
      );
      btn.addEventListener("click", () => {
        const u = new URL(location.href);
        u.searchParams.set("lang", btn.dataset.languagePill);
        location.href = u.href;
      });
    });
  }
  sync();
})();
