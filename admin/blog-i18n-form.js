(() => {
  const BLOG_TRANSLATION_LANGUAGES = [
    { code: 'pl', label: '🇵🇱 Polski', required: true },
    { code: 'en', label: '🇬🇧 English', required: true },
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeTranslation(input) {
    return {
      slug: String(input?.slug || '').trim(),
      title: String(input?.title || '').trim(),
      meta_title: String(input?.meta_title || '').trim(),
      meta_description: String(input?.meta_description || '').trim(),
      summary: String(input?.summary || '').trim(),
      lead: String(input?.lead || '').trim(),
      author_name: String(input?.author_name || '').trim(),
      author_url: String(input?.author_url || '').trim(),
      og_image_url: String(input?.og_image_url || '').trim(),
      cover_alt: String(input?.cover_alt || '').trim(),
      content_html: String(input?.content_html || '').trim(),
    };
  }

  function renderToolbar(lang) {
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

    return `
      <div class="blog-editor-toolbar" data-blog-editor-toolbar="${lang}">
        ${buttons.map(([action, label]) => `
          <button type="button" class="blog-editor-toolbar__btn" data-blog-editor-action="${action}" data-blog-editor-lang="${lang}">
            ${escapeHtml(label)}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderTranslationPanel(lang, translation, active) {
    const normalized = normalizeTranslation(translation);
    const code = lang.code;

    return `
      <div class="lang-content ${active ? 'active' : ''}" data-field="blogTranslation" data-lang="${code}">
        <div class="admin-form-grid blog-translation-grid">
          <label class="admin-form-field">
            <span>Slug (${code.toUpperCase()}) ${lang.required ? '*' : ''}</span>
            <input
              type="text"
              name="slug_${code}"
              data-blog-slug-input="${code}"
              value="${escapeHtml(normalized.slug)}"
              placeholder="article-slug-${code}"
              ${lang.required ? 'required' : ''}
            />
          </label>
          <label class="admin-form-field">
            <span>Title (${code.toUpperCase()}) ${lang.required ? '*' : ''}</span>
            <input
              type="text"
              name="title_${code}"
              data-blog-title-input="${code}"
              value="${escapeHtml(normalized.title)}"
              placeholder="Article title (${code.toUpperCase()})"
              ${lang.required ? 'required' : ''}
            />
          </label>
          <label class="admin-form-field blog-translation-grid__wide">
            <span>Meta title (${code.toUpperCase()})</span>
            <input
              type="text"
              name="meta_title_${code}"
              value="${escapeHtml(normalized.meta_title)}"
              placeholder="Optional SEO title override"
            />
          </label>
          <label class="admin-form-field blog-translation-grid__wide">
            <span>Meta description (${code.toUpperCase()}) ${lang.required ? '*' : ''}</span>
            <textarea
              name="meta_description_${code}"
              rows="2"
              placeholder="SEO description (${code.toUpperCase()})"
              ${lang.required ? 'required' : ''}
            >${escapeHtml(normalized.meta_description)}</textarea>
          </label>
          <label class="admin-form-field blog-translation-grid__wide">
            <span>Summary (${code.toUpperCase()}) ${lang.required ? '*' : ''}</span>
            <textarea
              name="summary_${code}"
              rows="3"
              placeholder="Short summary shown on cards"
              ${lang.required ? 'required' : ''}
            >${escapeHtml(normalized.summary)}</textarea>
          </label>
          <label class="admin-form-field blog-translation-grid__wide">
            <span>Lead (${code.toUpperCase()})</span>
            <textarea
              name="lead_${code}"
              rows="3"
              placeholder="Optional intro paragraph shown above content"
            >${escapeHtml(normalized.lead)}</textarea>
          </label>
          <label class="admin-form-field">
            <span>Author name (${code.toUpperCase()})</span>
            <input
              type="text"
              name="author_name_${code}"
              value="${escapeHtml(normalized.author_name)}"
              placeholder="Optional byline override"
            />
          </label>
          <label class="admin-form-field">
            <span>Author URL (${code.toUpperCase()})</span>
            <input
              type="url"
              name="author_url_${code}"
              value="${escapeHtml(normalized.author_url)}"
              placeholder="https://..."
            />
          </label>
          <label class="admin-form-field">
            <span>OG image URL (${code.toUpperCase()})</span>
            <input
              type="url"
              name="og_image_url_${code}"
              value="${escapeHtml(normalized.og_image_url)}"
              placeholder="Optional social card override"
            />
          </label>
          <label class="admin-form-field">
            <span>Cover alt (${code.toUpperCase()})</span>
            <input
              type="text"
              name="cover_alt_${code}"
              value="${escapeHtml(normalized.cover_alt)}"
              placeholder="Image alt text"
            />
          </label>
        </div>

        <div class="blog-editor-shell" data-blog-editor-shell="${code}">
          ${renderToolbar(code)}
          <div class="blog-editor-host" data-blog-editor-host="${code}"></div>
          <textarea
            class="blog-editor-fallback"
            name="content_html_${code}"
            data-blog-editor-fallback="${code}"
            rows="12"
            hidden
          >${escapeHtml(normalized.content_html)}</textarea>
        </div>
      </div>
    `;
  }

  function renderBlogTranslationFields(currentValues = {}) {
    const normalized = BLOG_TRANSLATION_LANGUAGES.reduce((accumulator, lang) => {
      accumulator[lang.code] = normalizeTranslation(currentValues?.[lang.code] || {});
      return accumulator;
    }, {});

    return `
      <div class="i18n-field-group blog-i18n-field-group">
        <div class="lang-tabs" data-field="blogTranslation">
          ${BLOG_TRANSLATION_LANGUAGES.map((lang) => `
            <button
              type="button"
              class="lang-tab ${lang.code === 'pl' ? 'active' : ''}"
              data-lang="${lang.code}"
              data-field="blogTranslation"
              onclick="switchBlogTranslationTab('${lang.code}')"
            >
              ${lang.label} ${lang.required ? '<span class="required">*</span>' : ''}
            </button>
          `).join('')}
        </div>
        ${BLOG_TRANSLATION_LANGUAGES.map((lang) => renderTranslationPanel(lang, normalized[lang.code], lang.code === 'pl')).join('')}
      </div>
    `;
  }

  function switchBlogTranslationTab(langCode) {
    document.querySelectorAll('.lang-tab[data-field="blogTranslation"]').forEach((button) => {
      button.classList.toggle('active', button.dataset.lang === langCode);
    });

    document.querySelectorAll('.lang-content[data-field="blogTranslation"]').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.lang === langCode);
    });
  }

  window.BLOG_TRANSLATION_LANGUAGES = BLOG_TRANSLATION_LANGUAGES;
  window.renderBlogTranslationFields = renderBlogTranslationFields;
  window.switchBlogTranslationTab = switchBlogTranslationTab;
})();
