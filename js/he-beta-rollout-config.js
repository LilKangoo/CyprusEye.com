(() => {
  const existing = window.CE_LANGUAGE_ROLLOUT_CONFIG || window.CE_LANGUAGE_ROLLOUT || {};
  const existingHe = existing && typeof existing === 'object' && existing.he && typeof existing.he === 'object'
    ? existing.he
    : {};

  window.CE_LANGUAGE_ROLLOUT_CONFIG = {
    ...existing,
    he: {
      mode: 'beta_users',
      switcher: true,
      routes: true,
      publicApi: true,
      seo: false,
      sitemap: false,
      hreflang: false,
      canonical: false,
      indexing: false,
      hiddenPreview: false,
      pageGated: true,
      stage25SqlApplied: false,
      betaUserIds: ['15f3d442-092d-4eb8-9627-db90da0283eb'],
      betaEmails: [],
      shopEnabled: false,
      seoEnabled: false,
      sitemapEnabled: false,
      hreflangEnabled: false,
      canonicalEnabled: false,
      indexingEnabled: false,
      ...existingHe,
    },
  };
})();
