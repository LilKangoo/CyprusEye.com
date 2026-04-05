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

  function renderTabs() {
    return `
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
    `;
  }

  function renderCopyButton(langCode, mode) {
    const source = langCode === 'pl' ? 'en' : 'pl';
    const sourceLabel = source.toUpperCase();
    return `
      <button
        type="button"
        class="btn-secondary blog-copy-btn"
        data-blog-copy-mode="${mode}"
        data-blog-copy-target="${langCode}"
        data-blog-copy-source="${source}"
      >
        Copy from ${sourceLabel}
      </button>
    `;
  }

  function renderField(label, inputHtml, help = '') {
    return `
      <label class="admin-form-field">
        <span>${label}</span>
        ${inputHtml}
        ${help ? `<small>${escapeHtml(help)}</small>` : ''}
      </label>
    `;
  }

  function renderContentPanel(lang, translation, active) {
    const normalized = normalizeTranslation(translation);
    const code = lang.code;
    return `
      <div class="lang-content ${active ? 'active' : ''}" data-field="blogTranslation" data-lang="${code}">
        <div class="blog-translation-panel__head">
          <div class="blog-translation-panel__intro">
            <strong>${escapeHtml(lang.label)}</strong>
            <p>Core content, slug and editor for ${code.toUpperCase()}.</p>
          </div>
          ${renderCopyButton(code, 'content')}
        </div>
        <div class="admin-form-grid blog-translation-grid">
          ${renderField(
            `Title (${code.toUpperCase()}) ${lang.required ? '*' : ''}`,
            `<input
              type="text"
              name="title_${code}"
              data-blog-title-input="${code}"
              data-blog-field="title"
              data-blog-lang="${code}"
              value="${escapeHtml(normalized.title)}"
              placeholder="Article title (${code.toUpperCase()})"
              ${lang.required ? 'required' : ''}
            />`,
            'Used on cards, article hero and as the default meta title.'
          )}
          ${renderField(
            `Slug (${code.toUpperCase()}) ${lang.required ? '*' : ''}`,
            `<input
              type="text"
              name="slug_${code}"
              data-blog-slug-input="${code}"
              data-blog-field="slug"
              data-blog-lang="${code}"
              value="${escapeHtml(normalized.slug)}"
              placeholder="article-slug-${code}"
              ${lang.required ? 'required' : ''}
            />`,
            'Auto-generated from the title until you edit it manually.'
          )}
          <label class="admin-form-field blog-translation-grid__wide">
            <span>Summary (${code.toUpperCase()}) ${lang.required ? '*' : ''}</span>
            <textarea
              name="summary_${code}"
              data-blog-field="summary"
              data-blog-lang="${code}"
              rows="3"
              placeholder="Short summary shown on cards"
              ${lang.required ? 'required' : ''}
            >${escapeHtml(normalized.summary)}</textarea>
            <small>Keep it concise. This is the short card summary.</small>
          </label>
          <label class="admin-form-field blog-translation-grid__wide">
            <span>Lead (${code.toUpperCase()})</span>
            <textarea
              name="lead_${code}"
              data-blog-field="lead"
              data-blog-lang="${code}"
              rows="3"
              placeholder="Optional intro paragraph shown above content"
            >${escapeHtml(normalized.lead)}</textarea>
            <small>The first sentence can automatically seed the meta description.</small>
          </label>
        </div>
        <div class="blog-editor-shell" data-blog-editor-shell="${code}">
          ${renderToolbar(code)}
          <div class="blog-editor-host" data-blog-editor-host="${code}"></div>
          <textarea
            class="blog-editor-fallback"
            name="content_html_${code}"
            data-blog-editor-fallback="${code}"
            data-blog-field="content_html"
            data-blog-lang="${code}"
            rows="12"
            hidden
          >${escapeHtml(normalized.content_html)}</textarea>
        </div>
      </div>
    `;
  }

  function renderSeoPanel(lang, translation, active) {
    const normalized = normalizeTranslation(translation);
    const code = lang.code;
    return `
      <div class="lang-content ${active ? 'active' : ''}" data-field="blogTranslation" data-lang="${code}">
        <div class="blog-translation-panel__head">
          <div class="blog-translation-panel__intro">
            <strong>${escapeHtml(lang.label)}</strong>
            <p>Search and social metadata for ${code.toUpperCase()}.</p>
          </div>
          ${renderCopyButton(code, 'seo')}
        </div>
        <div class="admin-form-grid blog-translation-grid">
          ${renderField(
            `Meta title (${code.toUpperCase()})`,
            `<input
              type="text"
              name="meta_title_${code}"
              data-blog-field="meta_title"
              data-blog-lang="${code}"
              value="${escapeHtml(normalized.meta_title)}"
              placeholder="Optional SEO title override"
            />`,
            'Defaults to the article title until edited manually.'
          )}
          <label class="admin-form-field blog-translation-grid__wide">
            <span>Meta description (${code.toUpperCase()}) ${lang.required ? '*' : ''}</span>
            <textarea
              name="meta_description_${code}"
              data-blog-field="meta_description"
              data-blog-lang="${code}"
              rows="3"
              placeholder="SEO description (${code.toUpperCase()})"
              ${lang.required ? 'required' : ''}
            >${escapeHtml(normalized.meta_description)}</textarea>
            <div class="blog-field-row">
              <small>Aim for around 140-160 characters. Auto-filled from the lead until edited.</small>
              <span class="blog-char-count" data-blog-char-count="meta_description:${code}">0 / 160</span>
            </div>
          </label>
          ${renderField(
            `OG image URL (${code.toUpperCase()})`,
            `<input
              type="url"
              name="og_image_url_${code}"
              data-blog-field="og_image_url"
              data-blog-lang="${code}"
              value="${escapeHtml(normalized.og_image_url)}"
              placeholder="Optional social card override"
            />`,
            'Leave empty to reuse the article cover image.'
          )}
          ${renderField(
            `Cover alt (${code.toUpperCase()})`,
            `<input
              type="text"
              name="cover_alt_${code}"
              data-blog-field="cover_alt"
              data-blog-lang="${code}"
              value="${escapeHtml(normalized.cover_alt)}"
              placeholder="Image alt text"
            />`,
            'Describe the cover image for accessibility and SEO.'
          )}
        </div>
      </div>
    `;
  }

  function renderAuthorPanel(lang, translation, active) {
    const normalized = normalizeTranslation(translation);
    const code = lang.code;
    return `
      <div class="lang-content ${active ? 'active' : ''}" data-field="blogTranslation" data-lang="${code}">
        <div class="blog-translation-panel__head">
          <div class="blog-translation-panel__intro">
            <strong>${escapeHtml(lang.label)}</strong>
            <p>Optional public byline overrides for ${code.toUpperCase()}.</p>
          </div>
          ${renderCopyButton(code, 'author')}
        </div>
        <div class="admin-form-grid blog-translation-grid">
          ${renderField(
            `Author name (${code.toUpperCase()})`,
            `<input
              type="text"
              name="author_name_${code}"
              data-blog-field="author_name"
              data-blog-lang="${code}"
              value="${escapeHtml(normalized.author_name)}"
              placeholder="Optional byline override"
            />`,
            'Leave empty to use the selected fallback profile name.'
          )}
          ${renderField(
            `Author URL (${code.toUpperCase()})`,
            `<input
              type="url"
              name="author_url_${code}"
              data-blog-field="author_url"
              data-blog-lang="${code}"
              value="${escapeHtml(normalized.author_url)}"
              placeholder="https://..."
            />`,
            'Optional public profile or website link for the byline.'
          )}
        </div>
      </div>
    `;
  }

  function renderPanels(currentValues, mode) {
    const normalized = BLOG_TRANSLATION_LANGUAGES.reduce((accumulator, lang) => {
      accumulator[lang.code] = normalizeTranslation(currentValues?.[lang.code] || {});
      return accumulator;
    }, {});

    const panelRenderer = mode === 'seo'
      ? renderSeoPanel
      : mode === 'author'
        ? renderAuthorPanel
        : renderContentPanel;

    return `
      <div class="i18n-field-group blog-i18n-field-group blog-i18n-field-group--${mode}">
        ${renderTabs()}
        ${BLOG_TRANSLATION_LANGUAGES.map((lang) => panelRenderer(lang, normalized[lang.code], lang.code === 'pl')).join('')}
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
  window.renderBlogTranslationFields = renderPanels;
  window.switchBlogTranslationTab = switchBlogTranslationTab;
})();
