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

  document.addEventListener('wakacjecypr:languagechange', syncFormLanguages);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncFormLanguages();
      showFormFeedback();
    });
  } else {
    syncFormLanguages();
    showFormFeedback();
  }
})();
