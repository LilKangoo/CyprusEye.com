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

  function formDataText(formData, name) {
    return String(formData?.get(name) || '').trim();
  }

  function getAdvertiseSupabaseClient() {
    if (typeof window.getSupabase === 'function') {
      const client = window.getSupabase();
      if (client && typeof client.rpc === 'function') return client;
    }
    if (window.sb && typeof window.sb.rpc === 'function') return window.sb;
    if (window.supabase && typeof window.supabase.rpc === 'function') return window.supabase;
    if (window.__SB__ && typeof window.__SB__.rpc === 'function') return window.__SB__;
    return null;
  }

  async function waitForAdvertiseSupabaseClient(timeoutMs = 2500) {
    const started = Date.now();
    let client = getAdvertiseSupabaseClient();
    while (!client && (Date.now() - started) < timeoutMs) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      client = getAdvertiseSupabaseClient();
    }
    return client;
  }

  function buildPartnerPlusRpcParams(formData) {
    return {
      p_source_context: formDataText(formData, 'context') || 'advertise-partner',
      p_language: getLanguage(),
      p_partner_type: formDataText(formData, 'partner_type'),
      p_package_tier: formDataText(formData, 'package_tier'),
      p_service: formDataText(formData, 'service'),
      p_name: formDataText(formData, 'name'),
      p_email: formDataText(formData, 'email'),
      p_phone: formDataText(formData, 'phone') || null,
      p_location: formDataText(formData, 'location'),
      p_website: formDataText(formData, 'website') || null,
      p_service_description: formDataText(formData, 'service_description'),
      p_tour_types: formDataText(formData, 'tour_types') || null,
      p_tour_languages: formDataText(formData, 'tour_languages') || null,
      p_tour_area: formDataText(formData, 'tour_area') || null,
      p_accommodation_type: formDataText(formData, 'accommodation_type') || null,
      p_accommodation_capacity: formDataText(formData, 'accommodation_capacity') || null,
      p_local_service_category: formDataText(formData, 'local_service_category') || null,
      p_local_service_offer: formDataText(formData, 'local_service_offer') || null,
      p_message: formDataText(formData, 'message') || null,
      p_referer: window.location.href,
      p_user_agent: navigator.userAgent || null,
    };
  }

  async function savePartnerPlusApplicationDirectly(formData) {
    const client = await waitForAdvertiseSupabaseClient();
    if (!client || typeof client.rpc !== 'function') {
      throw new Error(getText(
        'advertise.form.feedback.error',
        'Could not save the partner application. Please try again.',
      ));
    }

    const { data, error } = await client.rpc('submit_partner_plus_application', buildPartnerPlusRpcParams(formData));
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const applicationId = String(row?.id || '').trim();
    if (!applicationId) {
      throw new Error(getText(
        'advertise.form.feedback.error',
        'Could not save the partner application. Please try again.',
      ));
    }

    return {
      ok: true,
      application_id: applicationId,
      message: getText('advertise.form.feedback.success', 'Thank you. We will contact you soon.'),
      saved_via: 'supabase_rpc',
    };
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

    let response = null;
    let payload = {};
    let requestError = null;

    try {
      response = await fetch(form.action || '/api/forms/contact', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: new URLSearchParams(formData),
      });

      try {
        payload = await response.json();
      } catch (_) {
        payload = {};
      }
    } catch (error) {
      requestError = error;
    }

    const savedApplicationId = String(payload?.application_id || '').trim();
    if (isPartnerLead && (!response || !response.ok || payload?.error || !savedApplicationId)) {
      try {
        return await savePartnerPlusApplicationDirectly(formData);
      } catch (fallbackError) {
        if (payload?.error || requestError) {
          console.warn('Partner+ contact endpoint failed before direct save fallback:', payload?.error || requestError);
        }
        throw fallbackError;
      }
    }

    if (!response || !response.ok || payload?.error) {
      throw new Error(payload?.error || getText('advertise.form.feedback.error', 'Could not send the form. Please try again.'));
    }

    if (isPartnerLead && !savedApplicationId) {
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
