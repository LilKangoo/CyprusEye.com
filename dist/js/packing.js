(function(){
  'use strict';

  const packingGuide = (() => {
    try {
      // Prefer direct global binding created by non-module script
      // eslint-disable-next-line no-undef
      if (typeof PACKING_GUIDE !== 'undefined') return PACKING_GUIDE;
    } catch (_) { /* ignore */ }
    try {
      if (typeof window !== 'undefined' && window.PACKING_GUIDE) return window.PACKING_GUIDE;
    } catch (_) { /* ignore */ }
    return { universal: [], seasons: [] };
  })();
  let selectedPackingSeasonId = null;

  function getTranslationEntry(translations, key) {
    if (!key || !translations) return null;

    if (Object.prototype.hasOwnProperty.call(translations, key)) {
      return translations[key];
    }

    if (key.indexOf('.') !== -1) {
      const parts = key.split('.');
      let current = translations;

      for (const part of parts) {
        if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
          current = current[part];
        } else {
          return null;
        }
      }

      return current;
    }

    return null;
  }

  function translate(key, fallback = '') {
    try {
      const i18n = typeof window !== 'undefined' ? window.appI18n : null;
      if (i18n && i18n.translations) {
        const lang = i18n.language || 'pl';
        const translations = i18n.translations[lang] || {};
        const entry = getTranslationEntry(translations, key);
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          if (typeof entry.text === 'string') return entry.text;
          if (typeof entry.html === 'string') return entry.html;
        }
      }
    } catch (_) {}
    return fallback || '';
  }

  function determineDefaultPackingSeason() {
    const currentMonth = new Date().getMonth() + 1;
    const match = packingGuide.seasons.find((s) => Array.isArray(s.months) && s.months.includes(currentMonth));
    return match ? match.id : (packingGuide.seasons[0] && packingGuide.seasons[0].id);
  }

  function getPackingSeasonLabel(season) {
    if (!season) return '';
    return translate(`packing.season.${season.id}.label`, season.label || '');
  }

  function getPackingSeasonSummary(season) {
    if (!season) return '';
    return translate(`packing.season.${season.id}.summary`, season.summary || '');
  }

  function renderSeasonButtonLabel(button, season) {
    if (!button || !season) return;
    const label = getPackingSeasonLabel(season);
    button.innerHTML = `<span class="packing-season-icon">${season.emoji || ''}</span>${label}`;
    button.setAttribute('aria-label', `${label}`.trim());
  }

  function getPackingItemText(baseKey, item, field) {
    if (!item) return '';
    const fallback = item[field] || '';
    if (!item.key) return fallback;
    const key = `${baseKey}.${item.key}.${field}`;
    return translate(key, fallback);
  }

  function handlePackingSeasonKeydown(event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) return;

    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const buttons = Array.from(document.querySelectorAll('#packingSeasonToggle button'));
    const currentIndex = buttons.indexOf(target);
    if (currentIndex === -1) return;

    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = buttons.length - 1;

    const nextButton = buttons[nextIndex];
    if (nextButton instanceof HTMLButtonElement) {
      nextButton.focus();
      const seasonId = nextButton.dataset.season;
      if (seasonId) setPackingSeason(seasonId);
    }
  }

  function createPackingChecklist(items, idPrefix, baseKey) {
    const list = document.createElement('ul');
    list.className = 'packing-checklist';

    (items || []).forEach((item, index) => {
      const li = document.createElement('li');

      const input = document.createElement('input');
      input.type = 'checkbox';
      const inputId = `${idPrefix}-${index}`;
      input.id = inputId;

      const label = document.createElement('label');
      label.className = 'packing-check-label';
      label.setAttribute('for', inputId);

      const mainLine = document.createElement('div');
      mainLine.className = 'packing-check-main';
      const text = document.createElement('span');
      const labelText = baseKey ? getPackingItemText(baseKey, item, 'label') : (item.label || '');
      text.textContent = labelText;
      mainLine.appendChild(text);

      if (item.optional) {
        const optional = document.createElement('span');
        optional.className = 'packing-optional';
        optional.textContent = translate('packing.guide.optional', 'opcjonalnie');
        mainLine.appendChild(optional);
      }

      label.appendChild(mainLine);

      if (item.hint) {
        const hint = document.createElement('small');
        const hintText = baseKey ? getPackingItemText(baseKey, item, 'hint') : (item.hint || '');
        hint.textContent = hintText;
        label.appendChild(hint);
      }

      li.appendChild(input);
      li.appendChild(label);
      list.appendChild(li);
    });

    return list;
  }

  function renderPackingChecklist() {
    const panel = document.getElementById('packingChecklist');
    const toggle = document.getElementById('packingSeasonToggle');
    if (!panel || !toggle) return;

    const season = packingGuide.seasons.find((s) => s.id === selectedPackingSeasonId) || packingGuide.seasons[0];
    if (!season) {
      panel.innerHTML = '';
      return;
    }

    panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'packing-season-header';
    const heading = document.createElement('h3');
    heading.textContent = `${season.emoji || ''} ${getPackingSeasonLabel(season)}`.trim();
    const summary = document.createElement('p');
    summary.textContent = getPackingSeasonSummary(season);
    header.append(heading, summary);
    panel.appendChild(header);

    const listsWrapper = document.createElement('div');
    listsWrapper.className = 'packing-lists';

    const universalSection = document.createElement('section');
    universalSection.className = 'packing-list-section';
    const universalTitle = document.createElement('h4');
    universalTitle.textContent = translate('packing.guide.universal.title', 'Uniwersalne niezbędniki');
    universalSection.appendChild(universalTitle);
    universalSection.appendChild(
      createPackingChecklist(packingGuide.universal, `packing-universal-${season.id}`, 'packing.guide.universal')
    );
    listsWrapper.appendChild(universalSection);

    const seasonalSection = document.createElement('section');
    seasonalSection.className = 'packing-list-section';
    const seasonalTitle = document.createElement('h4');
    seasonalTitle.textContent = translate('packing.guide.seasonal.title', 'Dodatki sezonowe');
    seasonalSection.appendChild(seasonalTitle);
    seasonalSection.appendChild(
      createPackingChecklist(season.items || [], `packing-season-${season.id}`, `packing.guide.seasons.${season.id}`)
    );
    listsWrapper.appendChild(seasonalSection);

    panel.appendChild(listsWrapper);

    const buttons = toggle.querySelectorAll('button');
    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = button.dataset.season === season.id;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    });

    const activeTab = document.getElementById(`packingSeasonTab-${season.id}`);
    if (activeTab) {
      panel.setAttribute('aria-labelledby', activeTab.id);
    }
  }

  function setPackingSeason(seasonId) {
    const season = packingGuide.seasons.find((s) => s.id === seasonId) || packingGuide.seasons[0];
    if (!season) return;
    selectedPackingSeasonId = season.id;
    renderPackingChecklist();
  }

  function initializePackingPlanner() {
    const toggle = document.getElementById('packingSeasonToggle');
    const panel = document.getElementById('packingChecklist');
    const view = document.getElementById('packingView');

    if (view && view.hasAttribute('hidden')) view.removeAttribute('hidden');
    if (!toggle || !panel) return;

    toggle.innerHTML = '';
    toggle.setAttribute('aria-label', translate('packing.season.toggleLabel', 'Wybierz sezon podróży'));

    (packingGuide.seasons || []).forEach((season) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `packingSeasonTab-${season.id}`;
      button.dataset.season = season.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'packingChecklist');
      button.tabIndex = -1;
      button.className = 'packing-season-button';
      renderSeasonButtonLabel(button, season);

      button.addEventListener('click', () => setPackingSeason(season.id));
      button.addEventListener('keydown', handlePackingSeasonKeydown);

      toggle.appendChild(button);
    });

    const defaultSeason = determineDefaultPackingSeason();
    setPackingSeason(defaultSeason);
  }

  function updatePackingPlannerLanguage() {
    const toggle = document.getElementById('packingSeasonToggle');
    if (!toggle) return;
    toggle.setAttribute('aria-label', translate('packing.season.toggleLabel', 'Wybierz sezon podróży'));

    const buttons = toggle.querySelectorAll('button[data-season]');
    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const seasonId = button.dataset.season;
      const season = (packingGuide.seasons || []).find((s) => s.id === seasonId);
      if (season) renderSeasonButtonLabel(button, season);
    });

    renderPackingChecklist();
  }

  function onReady() {
    initializePackingPlanner();

    // Re-render when translations change (if i18n library dispatches an event)
    window.addEventListener('i18n:updated', updatePackingPlannerLanguage);
    document.addEventListener('wakacjecypr:languagechange', updatePackingPlannerLanguage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
})();
