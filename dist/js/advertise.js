(function () {
  'use strict';

  const PACKAGE_FIELD_SELECTOR = '#advertisePackageTier';
  const TYPE_FIELD_SELECTOR = '#advertisePartnerType';
  const FORM_SECTION_SELECTOR = '#advertiseFormSection';
  const FORM_SELECTOR = '#advertisePartnerForm';
  const SELECTED_PACKAGE_SELECTOR = '#advertiseSelectedPackageValue';
  const SELECTED_TYPE_SELECTOR = '#advertiseSelectedTypeValue';

  const AFFILIATE_LINKS = {
    pl: 'https://cypruseye.com/blog/jak-zarabiac-na-turystyce-na-cyprze-system-afiliacyjny-cypruseye?lang=pl',
    en: 'https://cypruseye.com/blog/how-to-earn-from-tourism-in-cyprus-cypruseye-affiliate-system?lang=en',
  };

  function getLanguage() {
    const language = String(window.appI18n?.language || document.documentElement.lang || 'en').trim().toLowerCase();
    return language === 'pl' ? 'pl' : 'en';
  }

  function getText(path, fallback = '') {
    const language = getLanguage();
    let current = window.appI18n?.translations?.[language] || null;
    if (!current || typeof current !== 'object') {
      return fallback;
    }

    for (const part of String(path || '').split('.')) {
      if (!part) continue;
      if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        return fallback;
      }
    }

    if (typeof current === 'string') {
      return current;
    }
    if (current && typeof current === 'object' && typeof current.text === 'string') {
      return current.text;
    }
    return fallback;
  }

  function scrollToForm() {
    const section = document.querySelector(FORM_SECTION_SELECTOR);
    if (!(section instanceof HTMLElement)) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function getPackageField() {
    return document.querySelector(PACKAGE_FIELD_SELECTOR);
  }

  function getTypeField() {
    return document.querySelector(TYPE_FIELD_SELECTOR);
  }

  function getOptionLabel(select, value) {
    if (!(select instanceof HTMLSelectElement)) return '';
    const option = Array.from(select.options).find((item) => item.value === value);
    return option ? option.textContent.trim() : '';
  }

  function syncPackageSummary() {
    const field = getPackageField();
    const target = document.querySelector(SELECTED_PACKAGE_SELECTOR);
    if (!(target instanceof HTMLElement)) return;
    const selectedLabel = getOptionLabel(field, field?.value || '');
    target.textContent = selectedLabel || getText('advertise.form.summary.packageEmpty', 'Not selected yet');
  }

  function syncTypeSummary() {
    const field = getTypeField();
    const target = document.querySelector(SELECTED_TYPE_SELECTOR);
    if (!(target instanceof HTMLElement)) return;
    const selectedLabel = getOptionLabel(field, field?.value || '');
    target.textContent = selectedLabel || getText('advertise.form.summary.typeEmpty', 'Choose partner type');
  }

  function syncPackageCards() {
    const field = getPackageField();
    const currentValue = String(field?.value || '').trim();
    document.querySelectorAll('[data-advertise-package-card]').forEach((card) => {
      const active = String(card.getAttribute('data-advertise-package-card') || '') === currentValue && currentValue;
      card.classList.toggle('is-selected', Boolean(active));
    });
    syncPackageSummary();
  }

  function syncTypePanels() {
    const field = getTypeField();
    const currentValue = String(field?.value || '').trim();

    document.querySelectorAll('[data-advertise-type-panel]').forEach((panel) => {
      const isActive = String(panel.getAttribute('data-advertise-type-panel') || '') === currentValue;
      panel.hidden = !isActive;
      panel.querySelectorAll('input, select, textarea').forEach((input) => {
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
          if (input.dataset.requiredWhen) {
            input.required = isActive;
          }
          input.disabled = !isActive;
        }
      });
    });

    document.querySelectorAll('[data-advertise-type-note]').forEach((note) => {
      note.hidden = String(note.getAttribute('data-advertise-type-note') || '') !== currentValue;
    });

    document.querySelectorAll('[data-advertise-partner-card]').forEach((card) => {
      const active = String(card.getAttribute('data-advertise-partner-card') || '') === currentValue && currentValue;
      card.classList.toggle('is-selected', Boolean(active));
    });

    syncTypeSummary();
  }

  function setPackageValue(value, { scroll = false } = {}) {
    const field = getPackageField();
    if (!(field instanceof HTMLSelectElement)) return;
    if (!Array.from(field.options).some((option) => option.value === value)) return;
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
    if (scroll) scrollToForm();
  }

  function setPartnerType(value, { scroll = false } = {}) {
    const field = getTypeField();
    if (!(field instanceof HTMLSelectElement)) return;
    if (!Array.from(field.options).some((option) => option.value === value)) return;
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
    if (scroll) scrollToForm();
  }

  function syncAffiliateLinks() {
    const language = getLanguage();
    const href = AFFILIATE_LINKS[language] || AFFILIATE_LINKS.en;
    document.querySelectorAll('[data-advertise-affiliate-link]').forEach((link) => {
      if (link instanceof HTMLAnchorElement) {
        link.href = href;
      }
    });
  }

  function setFormSubmitting(form, isSubmitting) {
    if (!(form instanceof HTMLFormElement)) return;
    form.classList.toggle('is-submitting', Boolean(isSubmitting));
    form.querySelectorAll('button[type="submit"]').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (isSubmitting) {
        button.dataset.originalText = button.textContent || '';
        button.textContent = getText('advertise.form.sending', 'Sending...');
        button.disabled = true;
      } else {
        button.disabled = false;
        if (button.dataset.originalText) {
          button.textContent = button.dataset.originalText;
          delete button.dataset.originalText;
        }
      }
    });
  }

  function setFormFeedback(message, type = 'status') {
    const feedback = document.querySelector('[data-form-feedback]');
    if (!(feedback instanceof HTMLElement)) return;
    feedback.hidden = false;
    feedback.textContent = message || '';
    feedback.setAttribute('role', type === 'error' ? 'alert' : 'status');
    feedback.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  }

  function closePartnerSuccessPopup() {
    const popup = document.querySelector('[data-advertise-success-popup]');
    if (popup instanceof HTMLElement) {
      popup.remove();
    }
  }

  function showPartnerSuccessPopup() {
    closePartnerSuccessPopup();

    const title = getText('advertise.form.successPopup.title', 'Application received');
    const body = getText(
      'advertise.form.successPopup.body',
      'We will review your application and contact you soon using the phone number or e-mail address provided.',
    );
    const closeLabel = getText('advertise.form.successPopup.close', 'Close');

    const overlay = document.createElement('div');
    overlay.className = 'advertise-success-popup';
    overlay.setAttribute('data-advertise-success-popup', '');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="advertise-success-popup__panel" role="document" tabindex="-1">
        <button type="button" class="advertise-success-popup__close" aria-label="${closeLabel}">×</button>
        <div class="advertise-success-popup__icon" aria-hidden="true">✓</div>
        <h2>${title}</h2>
        <p>${body}</p>
        <button type="button" class="btn btn-primary advertise-success-popup__button">${closeLabel}</button>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closePartnerSuccessPopup();
    });
    overlay.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', closePartnerSuccessPopup);
    });
    document.addEventListener('keydown', function onEscape(event) {
      if (event.key !== 'Escape') return;
      document.removeEventListener('keydown', onEscape);
      closePartnerSuccessPopup();
    });

    document.body.appendChild(overlay);
    const panel = overlay.querySelector('.advertise-success-popup__panel');
    if (panel instanceof HTMLElement) {
      panel.focus({ preventScroll: true });
    }
  }

  async function submitPartnerForm(form) {
    const formData = new FormData(form);
    formData.set('lang', getLanguage());
    const isPartnerLead = String(formData.get('context') || '').trim() === 'advertise-partner';

    const response = await fetch(form.action || '/api/forms/contact', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: new URLSearchParams(formData),
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      payload = {};
    }

    if (!response.ok || payload?.error) {
      throw new Error(payload?.error || getText('advertise.form.feedback.error', 'Could not send the form. Please try again.'));
    }

    if (isPartnerLead && !String(payload?.application_id || '').trim()) {
      throw new Error(getText(
        'advertise.form.feedback.error',
        'Could not save the partner application. Please try again.',
      ));
    }

    return payload;
  }

  async function handlePartnerFormSubmit(event) {
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    if (!form.checkValidity()) {
      return;
    }

    event.preventDefault();
    setFormSubmitting(form, true);

    try {
      const payload = await submitPartnerForm(form);
      const message = String(payload?.message || '').trim() || getText('advertise.form.feedback.success', 'Thank you. We will contact you soon.');
      setFormFeedback(message, 'status');
      showPartnerSuccessPopup();
      form.reset();
      syncPackageCards();
      syncTypePanels();
    } catch (error) {
      setFormFeedback(error?.message || getText('advertise.form.feedback.error', 'Could not send the form. Please try again.'), 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  }

  function applyQueryState() {
    const params = new URLSearchParams(window.location.search);
    const packageValue = String(params.get('package') || '').trim();
    const typeValue = String(params.get('partnerType') || params.get('partner_type') || '').trim();

    if (packageValue) {
      setPackageValue(packageValue, { scroll: false });
    }
    if (typeValue) {
      setPartnerType(typeValue, { scroll: false });
    }
  }

  function bindEvents() {
    const packageField = getPackageField();
    const typeField = getTypeField();
    const form = document.querySelector(FORM_SELECTOR);

    if (packageField instanceof HTMLSelectElement) {
      packageField.addEventListener('change', syncPackageCards);
    }

    if (typeField instanceof HTMLSelectElement) {
      typeField.addEventListener('change', syncTypePanels);
    }

    document.querySelectorAll('[data-advertise-package-select]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = String(button.getAttribute('data-advertise-package-select') || '').trim();
        if (!value) return;
        setPackageValue(value, { scroll: true });
      });
    });

    document.querySelectorAll('[data-advertise-partner-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = String(button.getAttribute('data-advertise-partner-preset') || '').trim();
        if (!value) return;
        setPartnerType(value, { scroll: true });
      });
    });

    if (form instanceof HTMLFormElement) {
      form.addEventListener('submit', (event) => {
        syncPackageSummary();
        syncTypeSummary();
        void handlePartnerFormSubmit(event);
      });
    }

    document.addEventListener('wakacjecypr:languagechange', () => {
      syncAffiliateLinks();
      syncPackageSummary();
      syncTypeSummary();
    });
  }

  function init() {
    bindEvents();
    applyQueryState();
    syncAffiliateLinks();
    syncPackageCards();
    syncTypePanels();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
