(function () {
  'use strict';

  const STORAGE_KEY = 'seenTutorial';
  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function safeLocalStorage(action, key, value) {
    try {
      if (action === 'get') {
        return window.localStorage.getItem(key);
      }
      if (action === 'set') {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('Local storage unavailable for tutorial state.', error);
    }
    return null;
  }

  function getTranslation(key, fallback) {
    const i18n = window.appI18n || {};
    const language = i18n.language || document.documentElement.lang || 'pl';
    const dictionary = (i18n.translations && i18n.translations[language]) || {};
    const entry = dictionary[key];
    if (typeof entry === 'string') {
      return entry;
    }
    if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string') {
        return entry.text;
      }
      if (typeof entry.html === 'string') {
        return entry.html;
      }
    }
    return fallback;
  }

  function areTranslationsReady() {
    const i18n = window.appI18n || {};
    const language = i18n.language || null;
    return Boolean(language && i18n.translations && i18n.translations[language]);
  }

  class Tutorial {
    constructor() {
      this.currentStepIndex = 0;
      this.overlay = null;
      this.backdrop = null;
      this.highlight = null;
      this.arrowElement = null;
      this.dialog = null;
      this.titleEl = null;
      this.descriptionEl = null;
      this.prevButton = null;
      this.nextButton = null;
      this.skipButton = null;
      this.helpButton = null;
      this.activeTarget = null;
      this.previouslyFocusedElement = null;
      this.launchSource = null;
      this.isOpen = false;
      this.initialized = false;
      this.translationsReady = false;
      this.hasAutoStarted = false;
      this.pendingFrame = null;

      this.steps = [
        {
          id: 'step1',
          target: '[data-tour-target="quick-actions"]',
          fallbackTitle: 'Szybkie działania w nagłówku',
          fallbackDescription:
            'Skocz do aktualnego celu, otwórz wynajem auta, przeglądaj atrakcje lub wezwij pomoc SOS jednym kliknięciem.',
          arrow: { icon: '⬆️', placement: 'bottom' },
        },
        {
          id: 'step2',
          target: '[data-tour-target="map-section"]',
          fallbackTitle: 'Mapa z przyciskiem meldowania',
          fallbackDescription:
            'Sprawdź interaktywną mapę, zamelduj się w aktualnym celu lub pomiń mapę za pomocą linku dostępności.',
          arrow: { icon: '⬆️', placement: 'bottom' },
        },
        {
          id: 'step3',
          target: '[data-tour-target="shortcut-cards"]',
          fallbackTitle: 'Karty skrótów po prawej stronie',
          fallbackDescription:
            'Przejdź stąd do planera pakowania, listy zadań i przewodnika po wynajmie auta – wszystko w jednym miejscu.',
          arrow: { icon: '➡️', placement: 'left' },
        },
        {
          id: 'step4',
          target: '[data-tour-target="tabs-navigation"]',
          fallbackTitle: 'Nawigacja po zakładkach i statystyki',
          fallbackDescription:
            'Tutaj zmienisz zakładki przygody, pakowania, zadań i VIP oraz sprawdzisz poziom, XP i zebrane odznaki.',
          arrow: { icon: '⬆️', placement: 'bottom' },
        },
        {
          id: 'step5',
          target: '[data-tour-target="help-button"]',
          fallbackTitle: 'Potrzebujesz powtórki?',
          fallbackDescription:
            'Kliknij przycisk Pokaż instrukcję w stopce, aby uruchomić samouczek ponownie w dowolnym momencie.',
          arrow: { icon: '⬇️', placement: 'top' },
        },
      ];

      this.handleLanguageChange = this.handleLanguageChange.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleViewportChange = this.handleViewportChange.bind(this);
      this.handleBackdropClick = this.handleBackdropClick.bind(this);
    }

    init() {
      if (this.initialized) {
        this.updateHelpButtonLabel();
        return;
      }

      this.initialized = true;
      this.createUi();
      this.helpButton = document.getElementById('tutorialHelpButton');
      if (this.helpButton) {
        this.helpButton.addEventListener('click', (event) => {
          const trigger = event.currentTarget;
          if (trigger instanceof HTMLElement) {
            this.start(trigger);
          } else {
            this.start();
          }
        });
      }

      document.addEventListener('wakacjecypr:languagechange', this.handleLanguageChange);
      this.translationsReady = areTranslationsReady();
      this.updateUiText();
      this.updateHelpButtonLabel();

      if (this.shouldAutoStart() && this.translationsReady) {
        this.start();
        this.hasAutoStarted = true;
      }
    }

    shouldAutoStart() {
      return !this.hasSeenTutorial() && this.isHomePage();
    }

    isHomePage() {
      return (document.body?.dataset?.seoPage || '') === 'home';
    }

    hasSeenTutorial() {
      return safeLocalStorage('get', STORAGE_KEY) === 'true';
    }

    markAsSeen() {
      safeLocalStorage('set', STORAGE_KEY, 'true');
      this.hasAutoStarted = true;
    }

    createUi() {
      if (this.overlay) {
        return;
      }

      this.overlay = document.createElement('div');
      this.overlay.className = 'tutorial-overlay';
      this.overlay.hidden = true;
      this.overlay.setAttribute('aria-hidden', 'true');

      this.backdrop = document.createElement('div');
      this.backdrop.className = 'tutorial-backdrop';
      this.overlay.appendChild(this.backdrop);

      this.highlight = document.createElement('div');
      this.highlight.className = 'tutorial-highlight';
      this.overlay.appendChild(this.highlight);

      this.arrowElement = document.createElement('div');
      this.arrowElement.className = 'tutorial-arrow';
      this.arrowElement.setAttribute('aria-hidden', 'true');
      this.overlay.appendChild(this.arrowElement);

      this.dialog = document.createElement('div');
      this.dialog.className = 'tutorial-dialog';
      this.dialog.setAttribute('role', 'dialog');
      this.dialog.setAttribute('aria-modal', 'true');
      this.dialog.setAttribute('tabindex', '-1');

      const titleId = 'tutorialDialogTitle';
      const descriptionId = 'tutorialDialogDescription';
      this.dialog.setAttribute('aria-labelledby', titleId);
      this.dialog.setAttribute('aria-describedby', descriptionId);

      const content = document.createElement('div');
      content.className = 'tutorial-content';
      content.setAttribute('aria-live', 'polite');

      this.titleEl = document.createElement('h2');
      this.titleEl.id = titleId;
      content.appendChild(this.titleEl);

      this.descriptionEl = document.createElement('p');
      this.descriptionEl.id = descriptionId;
      content.appendChild(this.descriptionEl);

      this.dialog.appendChild(content);

      const controls = document.createElement('div');
      controls.className = 'tutorial-controls';

      this.prevButton = document.createElement('button');
      this.prevButton.type = 'button';
      this.prevButton.className = 'tutorial-button-prev';
      this.prevButton.addEventListener('click', () => {
        this.previousStep();
      });

      this.skipButton = document.createElement('button');
      this.skipButton.type = 'button';
      this.skipButton.className = 'tutorial-button-skip';
      this.skipButton.addEventListener('click', () => {
        this.skipTutorial();
      });

      this.nextButton = document.createElement('button');
      this.nextButton.type = 'button';
      this.nextButton.className = 'tutorial-button-next';
      this.nextButton.addEventListener('click', () => {
        this.nextStep();
      });

      controls.append(this.prevButton, this.skipButton, this.nextButton);
      this.dialog.appendChild(controls);
      this.overlay.appendChild(this.dialog);

      document.body.appendChild(this.overlay);

      this.backdrop.addEventListener('click', this.handleBackdropClick);
    }

    waitForTranslations(callback) {
      if (this.translationsReady) {
        callback();
        return;
      }

      const handler = () => {
        this.translationsReady = areTranslationsReady();
        if (!this.translationsReady) {
          return;
        }
        document.removeEventListener('wakacjecypr:languagechange', handler);
        this.updateUiText();
        callback();
      };

      document.addEventListener('wakacjecypr:languagechange', handler);
    }

    start(triggerElement) {
      if (this.isOpen) {
        return;
      }

      const startTutorial = () => {
        this.previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.launchSource = triggerElement instanceof HTMLElement ? triggerElement : null;
        this.currentStepIndex = 0;
        this.openOverlay();
        this.renderCurrentStep({ focusButton: true });
      };

      if (!this.translationsReady) {
        this.waitForTranslations(() => {
          startTutorial();
        });
        return;
      }

      startTutorial();
    }

    openOverlay() {
      if (!this.overlay) {
        return;
      }

      this.isOpen = true;
      this.overlay.hidden = false;
      this.overlay.setAttribute('aria-hidden', 'false');
      this.overlay.classList.add('is-visible');
      document.body.classList.add('tutorial-open');

      document.addEventListener('keydown', this.handleKeydown, true);
      window.addEventListener('resize', this.handleViewportChange, { passive: true });
      window.addEventListener('scroll', this.handleViewportChange, { passive: true });

      requestAnimationFrame(() => {
        if (this.dialog) {
          this.dialog.focus({ preventScroll: true });
        }
        this.focusDefaultControl();
      });
    }

    closeOverlay() {
      if (!this.isOpen || !this.overlay) {
        return;
      }

      this.isOpen = false;
      this.overlay.classList.remove('is-visible');
      this.overlay.setAttribute('aria-hidden', 'true');
      this.overlay.hidden = true;
      document.body.classList.remove('tutorial-open');

      document.removeEventListener('keydown', this.handleKeydown, true);
      window.removeEventListener('resize', this.handleViewportChange);
      window.removeEventListener('scroll', this.handleViewportChange);

      if (this.pendingFrame) {
        cancelAnimationFrame(this.pendingFrame);
        this.pendingFrame = null;
      }

      if (this.activeTarget) {
        this.activeTarget.classList.remove('tutorial-target-active');
        this.activeTarget = null;
      }

      if (this.arrowElement) {
        this.arrowElement.classList.remove('is-visible');
      }

      if (this.highlight) {
        this.highlight.style.width = '0';
        this.highlight.style.height = '0';
      }

      const focusTarget = this.launchSource || this.previouslyFocusedElement;
      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus({ preventScroll: true });
      }
      this.launchSource = null;
      this.previouslyFocusedElement = null;
    }

    focusDefaultControl() {
      if (this.nextButton) {
        this.nextButton.focus({ preventScroll: true });
      }
    }

    getFocusableElements() {
      if (!this.dialog) {
        return [];
      }
      return Array.from(this.dialog.querySelectorAll(FOCUSABLE_SELECTORS)).filter((element) =>
        element instanceof HTMLElement && element.offsetParent !== null
      );
    }

    handleKeydown(event) {
      if (!this.isOpen) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.dismissTutorial();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = this.getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        if (this.dialog) {
          this.dialog.focus({ preventScroll: true });
        }
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (activeElement === first || !activeElement || !this.dialog?.contains(activeElement)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    handleBackdropClick(event) {
      if (event.target === this.backdrop) {
        this.dismissTutorial();
      }
    }

    handleViewportChange() {
      if (!this.isOpen) {
        return;
      }
      if (this.pendingFrame) {
        cancelAnimationFrame(this.pendingFrame);
      }
      this.pendingFrame = requestAnimationFrame(() => {
        this.pendingFrame = null;
        this.updateHighlight(undefined, { ensureVisible: false });
      });
    }

    handleLanguageChange() {
      const readyBefore = this.translationsReady;
      this.translationsReady = areTranslationsReady();
      this.updateUiText();
      this.updateHelpButtonLabel();

      if (!this.hasAutoStarted && this.shouldAutoStart() && this.translationsReady) {
        this.start();
        this.hasAutoStarted = true;
      }

      if (this.isOpen && this.translationsReady) {
        this.renderCurrentStep();
      } else if (!readyBefore && this.translationsReady) {
        this.updateUiText();
      }
    }

    updateUiText() {
      if (!this.prevButton || !this.nextButton || !this.skipButton) {
        return;
      }

      const prevLabel = getTranslation('tutorial.prev', 'Wstecz');
      const nextLabel = getTranslation('tutorial.next', 'Dalej');
      const skipLabel = getTranslation('tutorial.skip', 'Pomiń');

      this.prevButton.textContent = prevLabel;
      this.prevButton.setAttribute('aria-label', prevLabel);
      this.skipButton.textContent = skipLabel;
      this.skipButton.setAttribute('aria-label', skipLabel);
      this.nextButton.textContent = nextLabel;
      this.nextButton.setAttribute('aria-label', nextLabel);
    }

    updateHelpButtonLabel() {
      this.helpButton = this.helpButton || document.getElementById('tutorialHelpButton');
      if (!this.helpButton) {
        return;
      }
      const label = getTranslation('tutorial.showAgain', '🔁 Pokaż instrukcję');
      this.helpButton.textContent = label;
      this.helpButton.setAttribute('aria-label', label);
    }

    renderCurrentStep(options = {}) {
      const step = this.steps[this.currentStepIndex];
      if (!step) {
        return;
      }

      const title = getTranslation(`tutorial.${step.id}.title`, step.fallbackTitle);
      const description = getTranslation(`tutorial.${step.id}.description`, step.fallbackDescription);
      if (this.titleEl) {
        this.titleEl.textContent = title;
      }
      if (this.descriptionEl) {
        this.descriptionEl.textContent = description;
      }

      this.updateHighlight(step, { ensureVisible: true });
      this.updateNavigationButtons();

      if (options.focusButton) {
        this.focusDefaultControl();
      }
    }

    updateHighlight(step, options = {}) {
      const activeStep = step || this.steps[this.currentStepIndex];
      if (!activeStep || !this.highlight || !this.arrowElement) {
        return;
      }

      const target = document.querySelector(activeStep.target);
      if (this.activeTarget && this.activeTarget !== target) {
        this.activeTarget.classList.remove('tutorial-target-active');
      }

      if (target instanceof HTMLElement) {
        this.activeTarget = target;
        target.classList.add('tutorial-target-active');
        const rect = target.getBoundingClientRect();
        const padding = 14;
        const top = Math.max(rect.top - padding, 8);
        const left = Math.max(rect.left - padding, 8);
        const width = rect.width + padding * 2;
        const height = rect.height + padding * 2;

        this.highlight.style.top = `${top}px`;
        this.highlight.style.left = `${left}px`;
        this.highlight.style.width = `${Math.max(width, 60)}px`;
        this.highlight.style.height = `${Math.max(height, 60)}px`;

        if (options.ensureVisible && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }

        this.positionArrow(rect, activeStep.arrow);
      } else {
        this.activeTarget = null;
        this.highlight.style.width = '0';
        this.highlight.style.height = '0';
        this.arrowElement.classList.remove('is-visible');
      }
    }

    positionArrow(rect, arrowConfig) {
      if (!this.arrowElement || !arrowConfig) {
        return;
      }

      const margin = 16;
      let top = rect.top - margin;
      let left = rect.left + rect.width / 2;
      let translateX = '-50%';
      let translateY = '-100%';

      switch (arrowConfig.placement) {
        case 'bottom':
          top = rect.bottom + margin;
          translateY = '0';
          break;
        case 'left':
          left = rect.left - margin;
          translateX = '-100%';
          translateY = '-50%';
          top = rect.top + rect.height / 2;
          break;
        case 'right':
          left = rect.right + margin;
          translateX = '0';
          translateY = '-50%';
          top = rect.top + rect.height / 2;
          break;
        case 'top':
        default:
          top = rect.top - margin;
          translateY = '-100%';
          break;
      }

      this.arrowElement.textContent = arrowConfig.icon || '⬇️';
      this.arrowElement.style.top = `${top}px`;
      this.arrowElement.style.left = `${left}px`;
      this.arrowElement.style.transform = `translate(${translateX}, ${translateY})`;
      this.arrowElement.classList.add('is-visible');
    }

    updateNavigationButtons() {
      if (!this.prevButton || !this.nextButton || !this.skipButton) {
        return;
      }

      const isFirst = this.currentStepIndex === 0;
      const isLast = this.currentStepIndex === this.steps.length - 1;

      const prevLabel = getTranslation('tutorial.prev', 'Wstecz');
      const skipLabel = getTranslation('tutorial.skip', 'Pomiń');
      const nextLabel = isLast
        ? getTranslation('tutorial.finish', 'Zakończ')
        : getTranslation('tutorial.next', 'Dalej');

      this.prevButton.disabled = isFirst;
      this.prevButton.textContent = prevLabel;
      this.prevButton.setAttribute('aria-label', prevLabel);

      this.skipButton.textContent = skipLabel;
      this.skipButton.setAttribute('aria-label', skipLabel);

      this.nextButton.textContent = nextLabel;
      this.nextButton.setAttribute('aria-label', nextLabel);
    }

    nextStep() {
      if (this.currentStepIndex >= this.steps.length - 1) {
        this.finishTutorial();
        return;
      }
      this.currentStepIndex += 1;
      this.renderCurrentStep({ focusButton: true });
    }

    previousStep() {
      if (this.currentStepIndex === 0) {
        return;
      }
      this.currentStepIndex -= 1;
      this.renderCurrentStep({ focusButton: true });
    }

    skipTutorial() {
      this.markAsSeen();
      this.closeOverlay();
    }

    finishTutorial() {
      this.markAsSeen();
      this.closeOverlay();
    }

    dismissTutorial() {
      this.markAsSeen();
      this.closeOverlay();
    }
  }

  const tutorialInstance = new Tutorial();
  window.appTutorial = tutorialInstance;
})();
