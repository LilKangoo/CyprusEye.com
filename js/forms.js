(function () {
  'use strict';

  function getActiveLanguage() {
    if (window.appI18n && window.appI18n.language) {
      return window.appI18n.language;
    }
    return document.documentElement.lang || 'pl';
  }

  function syncFormLanguages() {
    const language = getActiveLanguage();
    document.querySelectorAll('[data-enhanced-form]').forEach((form) => {
      let hiddenField = form.querySelector('input[name="lang"]');
      if (!hiddenField) {
        hiddenField = document.createElement('input');
        hiddenField.type = 'hidden';
        hiddenField.name = 'lang';
        form.appendChild(hiddenField);
      }
      hiddenField.value = language;
      hiddenField.defaultValue = language;
    });
  }

  function showFormFeedback() {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('success') === '1';
    const isError = params.get('error') === '1';

    document.querySelectorAll('[data-form-feedback]').forEach((element) => {
      element.hidden = true;
      element.removeAttribute('role');

      if (isSuccess) {
        element.textContent = element.dataset.successMessage || 'Dziękujemy! Formularz został wysłany.';
        element.hidden = false;
        element.setAttribute('role', 'status');
        element.setAttribute('aria-live', 'polite');
      } else if (isError) {
        element.textContent = element.dataset.errorMessage || 'Nie udało się wysłać formularza. Spróbuj ponownie.';
        element.hidden = false;
        element.setAttribute('role', 'alert');
        element.setAttribute('aria-live', 'assertive');
      }
    });
  }

  function enhanceValidation() {
    const containersSelector = '.form-field, .auto-field, .auto-checkbox, .vip-field, .standalone-form';

    document.querySelectorAll('form').forEach((form) => {
      const trackedFields = Array.from(form.querySelectorAll('input, select, textarea')).map((field, index) => {
        if (!field.id) {
          const baseId = form.id || field.name || field.type || 'field';
          field.id = `${baseId}-${index}`;
        }

        const wrapper = field.closest(containersSelector) || field.parentElement;
        let errorEl = wrapper ? wrapper.querySelector('.form-error') : null;

        if (wrapper && !errorEl) {
          errorEl = document.createElement('p');
          errorEl.className = 'form-error';
          errorEl.id = `${field.id}Error`;
          errorEl.setAttribute('role', 'alert');
          errorEl.hidden = true;
          wrapper.appendChild(errorEl);
        } else if (errorEl && !errorEl.id) {
          errorEl.id = `${field.id}Error`;
        }

        if (errorEl) {
          const describedBy = field.getAttribute('aria-describedby');
          const tokens = new Set((describedBy || '').split(' ').filter(Boolean));
          tokens.add(errorEl.id);
          field.setAttribute('aria-describedby', Array.from(tokens).join(' '));
        }

        const updateValidity = () => {
          if (!field.checkValidity()) {
            field.setAttribute('aria-invalid', 'true');
            if (errorEl) {
              errorEl.textContent = field.validationMessage;
              errorEl.hidden = false;
            }
          } else {
            field.removeAttribute('aria-invalid');
            if (errorEl) {
              errorEl.textContent = '';
              errorEl.hidden = true;
            }
          }
        };

        field.addEventListener('input', updateValidity);
        field.addEventListener('change', updateValidity);
        field.addEventListener('blur', updateValidity);

        return { field, updateValidity };
      });

      form.addEventListener('submit', (event) => {
        let hasInvalid = false;

        trackedFields.forEach(({ field, updateValidity }) => {
          updateValidity();
          if (!field.checkValidity()) {
            hasInvalid = true;
          }
        });

        if (hasInvalid) {
          event.preventDefault();
          const firstInvalid = trackedFields.find(({ field }) => !field.checkValidity());
          if (firstInvalid) {
            firstInvalid.field.focus({ preventScroll: false });
          }
        }
      });
    });
  }

  document.addEventListener('wakacjecypr:languagechange', syncFormLanguages);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncFormLanguages();
      showFormFeedback();
      enhanceValidation();
    });
  } else {
    syncFormLanguages();
    showFormFeedback();
    enhanceValidation();
  }
})();
