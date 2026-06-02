(() => {
  const existing = window.CE_LANGUAGE_ROLLOUT_CONFIG || window.CE_LANGUAGE_ROLLOUT || {};
  const existingHe = existing && typeof existing === 'object' && existing.he && typeof existing.he === 'object'
    ? existing.he
    : {};
  const existingHePageReadiness = existingHe.pageReadiness && typeof existingHe.pageReadiness === 'object'
    ? existingHe.pageReadiness
    : {};

  window.CE_LANGUAGE_ROLLOUT_CONFIG = {
    ...existing,
    he: {
      mode: 'partial_public',
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
      stage25SqlApplied: true,
      stage33SqlApplied: true,
      recordGatedPagesPublic: true,
      allowPartialPagesPublic: false,
      betaUserIds: ['15f3d442-092d-4eb8-9627-db90da0283eb'],
      betaEmails: [],
      shopEnabled: false,
      seoEnabled: false,
      sitemapEnabled: false,
      hreflangEnabled: false,
      canonicalEnabled: false,
      indexingEnabled: false,
      ...existingHe,
      pageReadiness: {
        ...existingHePageReadiness,
        home: existingHePageReadiness.home || {
          status: 'ready',
          allowFallback: false,
          reason: 'Stage39 controlled Home aggregation rollout; blocked/excluded modules are hidden or normalized to EN/LTR.',
        },
      },
    },
  };
})();
