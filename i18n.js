(function () {
  'use strict';

  const DEFAULT_LANGUAGE = 'pl';
  const STORAGE_KEY = 'wakacjecypr-language';
  const SUPPORTED_LANGUAGES = {
    pl: { label: 'Polski', flag: '🇵🇱', dir: 'ltr' },
    en: { label: 'English', flag: '🇬🇧', dir: 'ltr' },
  };

  const translations = {
    en: {
      'language.switcher.label': 'Language',
      'language.option.pl': '🇵🇱 Polish',
      'language.option.en': '🇬🇧 English',
      'header.notifications': '🔔 Notifications',
      'header.login': '🔐 Sign in',
      'header.accountSettings': '⚙️ Account settings',
      'header.logout': 'Log out',
      'header.brand': {
        html: '<h1>HolidayCyprus <span>Quest</span></h1><p class="tagline">Explore Cyprus in an interactive way – earn badges, experience, and discover our best offers.</p>',
      },
      'header.jumpToObjective': 'Jump to current objective',
      'header.carRentalLink': '🚗 Car rental',
      'header.explorerToggle': '🌍 Browse attractions',
      'header.sosToggle': '🚨 SOS',
      'metrics.level.label': 'Level',
      'metrics.level.subtext': 'Get your first check-ins to level up!',
      'metrics.xp.label': 'Experience',
      'metrics.badges.label': 'Badges',
      'metrics.badges.subtext': 'Explore attractions and collect souvenirs.',
      'nav.adventure': '🎯 Your adventure',
      'nav.packing': '🎒 Packing planner',
      'nav.tasks': '✅ Tasks to complete',
      'nav.mediaTrips': '✨ VIP individual trips',
      'objective.title': 'Current location',
      'objective.mapLink': 'View on Google Maps',
      'objective.previous': '← Previous place',
      'objective.next': 'Next place →',
      'objective.checkIn': 'Check in to earn XP',
      'objective.hint': 'Tip: allow the app to use your location to confirm you are on site.',
      'shortcuts.packing.title': '🎒 Packing planner',
      'shortcuts.packing.description': 'Plan your suitcase with dedicated lists for each travel season.',
      'shortcuts.packing.action': 'Go to planner',
      'shortcuts.tasks.title': '✅ Task list',
      'shortcuts.tasks.description': 'Review pre-trip challenges and log your progress in a separate tab.',
      'shortcuts.tasks.action': 'Open tasks',
      'shortcuts.car.title': '🚗 Car rental in Cyprus',
      'shortcuts.car.description': 'Explore the fleet, compare prices, and book a car on the dedicated page.',
      'shortcuts.car.action': 'Go to rental',
      'discovery.title': 'Attractions to discover',
      'discovery.subtitle': 'Browse in-game locations and plan your next check-ins from the map.',
      'discovery.toggle': 'Show more attractions',
      'discovery.catalog': '📚 Attractions catalogue',
      'packing.header.title': 'Packing planner',
      'packing.header.subtitle': 'Take everything you need for Cyprus – pick the season and tick off each item.',
      'packing.header.back': '← Back to adventure',
      'packing.panel.title': 'Packing planner',
      'packing.panel.subtitle': 'Choose a travel season and tick items that will be useful during your Cyprus holidays.',
      'packing.note': 'Check items as you pack – refresh the list for your next trip.',
      'tasks.header.title': 'Tasks to complete',
      'tasks.header.subtitle': 'Prepare for the trip with missions that grant XP and keep your planning organised.',
      'tasks.header.back': '← Back to adventure',
      'tasks.hint': 'Complete tasks to earn extra XP and prepare your Cyprus adventures.',
      'mediaTrips.header.title': 'VIP photo and video trips',
      'mediaTrips.header.subtitle': 'Book individual photo or video packages with the WakacjeCypr.com crew and instantly see the per-person cost for your group.',
      'mediaTrips.header.back': '← Back to adventure',
      'mediaTrips.intro': 'Choose a photo or video package, enter the number of participants, and see the total cost and price per person. Up to 4 people are covered by the base price; add more using the calculator below.',
      'services.title': 'Discover Cyprus with us',
      'services.description': 'WakacjeCypr.com are local experts ready to organise unforgettable holidays, private tours, wine tastings, and cruises for you.',
      'services.itemOne': 'Tailor-made itineraries aligned with your check-ins.',
      'services.itemTwo': 'Guided tours in the places you have already unlocked.',
      'services.itemThree': 'Contact us straight from the app – tap the button below.',
      'services.cta': 'Discover our services',
      'mobile.nav.adventure': 'Adventure',
      'mobile.nav.packing': 'Packing',
      'mobile.nav.tasks': 'Missions',
      'mobile.nav.mediaTrips': 'VIP',
      'footer.app': '© <span id="year"></span> WakacjeCypr.com • Play, explore and plan your holidays at the same time.',
      'notifications.title': 'Notifications',
      'notifications.markAll': 'Mark all as read',
      'notifications.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close notifications' },
      },
      'notifications.empty': 'Sign in to see your notifications.',
      'explorer.title': 'Interactive Cyprus guide',
      'explorer.subtitle': 'Browse all our locations and pick where you want to go next.',
      'explorer.filterLabel': 'Filter attractions',
      'explorer.filter.all': 'All places',
      'explorer.filter.available': 'To visit',
      'explorer.filter.visited': 'Earned badges',
      'explorer.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close window' },
      },
      'auth.title': 'Sign in or create an account',
      'auth.subtitle': 'Save your stats and continue adventures on any device.',
      'auth.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close sign-in window' },
      },
      'auth.login.title': 'Sign in',
      'auth.login.username': 'Email address or username',
      'auth.login.password': 'Password',
      'auth.login.submit': 'Sign in',
      'auth.divider': 'OR',
      'auth.register.title': 'Create account',
      'auth.register.username': 'Email address or username',
      'auth.register.password': 'Password',
      'auth.register.confirm': 'Repeat password',
      'auth.register.hint': 'Your current progress will be saved to the new account.',
      'auth.register.submit': 'Create account',
      'auth.guest.button': '🎮 Continue as guest',
      'auth.guest.description': 'You can use the app without an account – progress will stay on this device.',
      'sos.title': 'SOS',
      'sos.description': 'Quick access to emergency numbers, embassy contacts, and medical guidance.',
      'sos.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close SOS window' },
      },
      'sos.emergency.title': '🚑 Emergency numbers in Cyprus',
      'sos.emergency.eu': 'EU emergency number (police, ambulance, fire). <a href="tel:112">Call now</a>',
      'sos.emergency.cyprus': 'Cypriot emergency number – works alongside 112. <a href="tel:199">Call</a>',
      'sos.emergency.police': '24/7 police line (dial the full code when abroad). <a href="tel:+35722802020">Call</a>',
      'sos.embassy.title': '🛡️ Embassy of Poland in Nicosia',
      'sos.embassy.hotline': '<a href="tel:+35799660451">+357 99 660 451</a> (emergency support for Polish citizens).',
      'sos.embassy.reception': '<a href="tel:+35722751777">+357 22 751 777</a> (Mon–Fri during office hours).',
      'sos.embassy.address': '14, Ifigenias Street, 2007 Nicosia • <a href="https://maps.google.com/?q=Embassy+of+Poland+in+Cyprus" target="_blank" rel="noopener">Get directions</a>',
      'sos.embassy.email': '<a href="mailto:nicosia.info@msz.gov.pl">nicosia.info@msz.gov.pl</a>',
      'sos.healthcare.title': '🏥 Closest medical help',
      'sos.healthcare.hospital': '24/7 emergency department, Anavargos, Paphos. <a href="tel:+35726803000">+357 26 803 000</a> • <a href="https://maps.google.com/?q=Paphos+General+Hospital" target="_blank" rel="noopener">Directions</a>',
      'sos.healthcare.search': '<a href="https://www.google.com/maps/search/hospital+near+me/" target="_blank" rel="noopener">Open the hospital list on Google Maps</a> and share your location to see nearby options.',
      'sos.healthcare.pharmacy': 'Check duty pharmacies on the <a href="https://pharmacy.dl.moh.gov.cy/" target="_blank" rel="noopener">Ministry of Health website</a> or search for a <a href="https://www.google.com/maps/search/pharmacy+near+me/" target="_blank" rel="noopener">pharmacy nearby</a>.',
      'sos.healthcare.note': 'In life-threatening situations always call 112 and clearly state your location. Enable location sharing in the app to find help faster on the map.',
      'account.title': 'Account settings',
      'account.subtitle': 'Update your login details or start the adventure from scratch.',
      'account.close': {
        text: '✕',
        attributes: { 'aria-label': 'Close account settings' },
      },
      'account.username.title': 'Change username',
      'account.username.label': 'New username',
      'account.username.hint': 'Changes are saved instantly and will appear in the greeting.',
      'account.username.submit': 'Save name',
      'account.password.title': 'Update password',
      'account.password.current': 'Current password',
      'account.password.new': 'New password',
      'account.password.confirm': 'Repeat new password',
      'account.password.hint': 'Password must be at least 8 characters long.',
      'account.password.submit': 'Change password',
      'account.reset.title': 'Restart game',
      'account.reset.description': 'Reset collected badges and experience to start again from level one.',
      'account.reset.action': '🔄 Reset progress',
    },
  };

  const defaultHtml = new WeakMap();
  const attributeDefaults = new WeakMap();
  let currentLanguage = DEFAULT_LANGUAGE;

  function storeDefaultHtml(element) {
    if (!defaultHtml.has(element)) {
      defaultHtml.set(element, element.innerHTML);
    }
  }

  function storeDefaultAttributes(element, attributes) {
    if (!attributeDefaults.has(element)) {
      attributeDefaults.set(element, {});
    }
    const stored = attributeDefaults.get(element);
    attributes.forEach((name) => {
      if (!(name in stored)) {
        stored[name] = element.getAttribute(name);
      }
    });
  }

  function restoreAttributes(element) {
    const stored = attributeDefaults.get(element);
    if (!stored) return;
    Object.entries(stored).forEach(([name, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    });
  }

  function applyAttributes(element, attributes) {
    const names = Object.keys(attributes);
    if (!names.length) {
      restoreAttributes(element);
      return;
    }
    storeDefaultAttributes(element, names);
    names.forEach((name) => {
      const value = attributes[name];
      if (value === null || value === undefined) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    });
  }

  function applyElementTranslation(element, language) {
    storeDefaultHtml(element);
    if (language === DEFAULT_LANGUAGE) {
      element.innerHTML = defaultHtml.get(element);
      restoreAttributes(element);
      return;
    }

    const key = element.dataset.i18nKey;
    const translation = translations[language] && translations[language][key];

    if (!translation) {
      element.innerHTML = defaultHtml.get(element);
      restoreAttributes(element);
      return;
    }

    if (typeof translation === 'string') {
      element.innerHTML = translation;
      restoreAttributes(element);
      return;
    }

    if (translation.html !== undefined) {
      element.innerHTML = translation.html;
    } else if (translation.text !== undefined) {
      element.textContent = translation.text;
    } else {
      element.innerHTML = defaultHtml.get(element);
    }

    if (translation.attributes) {
      applyAttributes(element, translation.attributes);
    } else {
      restoreAttributes(element);
    }
  }

  function applyLanguage(language) {
    const lang = SUPPORTED_LANGUAGES[language] ? language : DEFAULT_LANGUAGE;
    currentLanguage = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = SUPPORTED_LANGUAGES[lang].dir || 'ltr';

    document.querySelectorAll('[data-i18n-key]').forEach((element) => {
      applyElementTranslation(element, lang);
    });
  }

  function persistLanguage(language) {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.warn('Unable to persist language preference', error);
    }
  }

  function loadLanguagePreference() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES[stored]) {
        return stored;
      }
    } catch (error) {
      console.warn('Unable to load language preference', error);
    }
    return DEFAULT_LANGUAGE;
  }

  function setLanguage(language) {
    const next = SUPPORTED_LANGUAGES[language] ? language : DEFAULT_LANGUAGE;
    if (currentLanguage === next) {
      return;
    }
    persistLanguage(next);
    applyLanguage(next);
    updateSwitcherValue(next);
    document.dispatchEvent(
      new CustomEvent('wakacjecypr:languagechange', {
        detail: { language: next },
      })
    );
  }

  function updateSwitcherValue(language) {
    const select = document.getElementById('languageSwitcherSelect');
    if (select && select.value !== language) {
      select.value = language;
    }
  }

  function createLanguageSwitcher() {
    if (document.getElementById('languageSwitcherSelect')) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'language-switcher';

    const label = document.createElement('label');
    label.className = 'language-switcher-label';
    label.htmlFor = 'languageSwitcherSelect';
    label.dataset.i18nKey = 'language.switcher.label';
    label.textContent = 'Język';

    const select = document.createElement('select');
    select.id = 'languageSwitcherSelect';
    select.className = 'language-switcher-select';
    select.setAttribute('aria-label', 'Language selector');

    Object.entries(SUPPORTED_LANGUAGES).forEach(([code, info]) => {
      const option = document.createElement('option');
      option.value = code;
      option.dataset.i18nKey = `language.option.${code}`;
      option.textContent = `${info.flag} ${info.label}`;
      select.append(option);
    });

    select.addEventListener('change', (event) => {
      const value = event.target.value;
      setLanguage(value);
    });

    container.append(label, select);
    document.body.append(container);
  }

  function init() {
    createLanguageSwitcher();
    const initialLanguage = loadLanguagePreference();
    updateSwitcherValue(initialLanguage);
    applyLanguage(initialLanguage);
  }

  document.addEventListener('DOMContentLoaded', init);

  window.appI18n = {
    get language() {
      return currentLanguage;
    },
    setLanguage,
    applyLanguage,
    translations,
  };
})();
