/**
 * RECOMMENDATIONS PAGE - CYPRUSEYE QUEST
 * Public-facing recommendations rendered with the same card/modal pattern as home.
 */

import { supabase } from '/js/supabaseClient.js';
import { waitForAuthReady } from '/js/authUi.js?v=4';

let allRecommendations = [];
let allCategories = [];
let currentCategoryFilter = '';
let recommendationsSavedOnly = false;
let recommendationsModalPanoramaCleanup = null;
let recommendationsModalPanoramaHintCleanup = null;
let recommendationsInitialized = false;
let recommendationsModalPreviouslyFocused = null;
let recommendationsScrollLockDepth = 0;
let recommendationsScrollPositionBeforeLock = 0;
let recommendationsPreviousHtmlOverflow = '';
let recommendationsPreviousBodyOverflow = '';
let recommendationsPreviousBodyPosition = '';
let recommendationsPreviousBodyTop = '';
let recommendationsPreviousBodyLeft = '';
let recommendationsPreviousBodyRight = '';
let recommendationsPreviousBodyWidth = '';
let recommendationsPreviousBodyPaddingRight = '';
let recommendationsModalTouchStartY = 0;
let recommendationDeepLinkOpened = false;

const RECOMMENDATION_MODAL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

function getRecommendationDeepLinkId() {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const url = new URL(window.location.href);
    return String(
      url.searchParams.get('recommendation')
      || url.searchParams.get('rec')
      || ''
    ).trim();
  } catch (_) {
    return '';
  }
}

function maybeOpenRecommendationDeepLink() {
  if (recommendationDeepLinkOpened) {
    return;
  }
  const recommendationId = getRecommendationDeepLinkId();
  if (!recommendationId) {
    return;
  }
  const matchedRecommendation = allRecommendations.find((item) => String(item?.id || '').trim() === recommendationId);
  if (!matchedRecommendation) {
    return;
  }
  recommendationDeepLinkOpened = true;
  requestAnimationFrame(() => {
    void openRecommendationDetailModal(matchedRecommendation.id);
  });
}

function getRecommendationDetailModal() {
  return document.getElementById('detailModal');
}

function getRecommendationModalDialog() {
  return getRecommendationDetailModal()?.querySelector('.modal-content') || null;
}

function isRecommendationModalOpen() {
  const modal = getRecommendationDetailModal();
  return Boolean(modal && modal.style.display !== 'none');
}

function getRecommendationFocusableElements() {
  const container = getRecommendationModalDialog() || getRecommendationDetailModal();
  if (!(container instanceof HTMLElement)) {
    return [];
  }

  return Array.from(container.querySelectorAll(RECOMMENDATION_MODAL_FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      return element.offsetParent !== null || style.position === 'fixed';
    }
  );
}

function focusRecommendationModal() {
  const focusableElements = getRecommendationFocusableElements();
  if (focusableElements.length > 0) {
    focusableElements[0].focus({ preventScroll: true });
    return;
  }

  const dialog = getRecommendationModalDialog();
  if (dialog instanceof HTMLElement) {
    dialog.focus({ preventScroll: true });
  }
}

function closeRecommendationDetailModal() {
  clearRecommendationModalPanorama();
  const modal = getRecommendationDetailModal();
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    unlockRecommendationBodyScroll();
  }

  if (recommendationsModalPreviouslyFocused instanceof HTMLElement) {
    recommendationsModalPreviouslyFocused.focus({ preventScroll: true });
  }
  recommendationsModalPreviouslyFocused = null;
}

function getRecommendationModalScrollableTarget(target) {
  const dialog = getRecommendationModalDialog();
  if (!(dialog instanceof HTMLElement) || !(target instanceof Node)) {
    return null;
  }

  return dialog.contains(target) ? dialog : null;
}

function handleRecommendationModalWheel(event) {
  if (!isRecommendationModalOpen()) {
    return;
  }

  if (!getRecommendationModalScrollableTarget(event.target)) {
    event.preventDefault();
  }
}

function handleRecommendationModalTouchStart(event) {
  if (!isRecommendationModalOpen()) {
    return;
  }

  recommendationsModalTouchStartY = event.touches?.[0]?.clientY ?? 0;
}

function handleRecommendationModalTouchMove(event) {
  if (!isRecommendationModalOpen()) {
    return;
  }

  const dialog = getRecommendationModalScrollableTarget(event.target);
  if (!(dialog instanceof HTMLElement)) {
    event.preventDefault();
    return;
  }

  const nextTouchY = event.touches?.[0]?.clientY;
  if (!Number.isFinite(nextTouchY)) {
    return;
  }

  const deltaY = recommendationsModalTouchStartY - nextTouchY;
  const canScroll = dialog.scrollHeight > dialog.clientHeight;
  const atTop = dialog.scrollTop <= 0;
  const atBottom = Math.ceil(dialog.scrollTop + dialog.clientHeight) >= dialog.scrollHeight;

  if (!canScroll || (deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
    event.preventDefault();
  }

  recommendationsModalTouchStartY = nextTouchY;
}

function lockRecommendationBodyScroll() {
  if (recommendationsScrollLockDepth === 0) {
    recommendationsScrollPositionBeforeLock = window.scrollY || window.pageYOffset || 0;
    recommendationsPreviousHtmlOverflow = document.documentElement.style.overflow;
    recommendationsPreviousBodyOverflow = document.body.style.overflow;
    recommendationsPreviousBodyPosition = document.body.style.position;
    recommendationsPreviousBodyTop = document.body.style.top;
    recommendationsPreviousBodyLeft = document.body.style.left;
    recommendationsPreviousBodyRight = document.body.style.right;
    recommendationsPreviousBodyWidth = document.body.style.width;
    recommendationsPreviousBodyPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.classList.add('recommendations-modal-open');
    document.body.classList.add('recommendations-modal-open', 'u-lock-scroll', 'is-modal-open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${recommendationsScrollPositionBeforeLock}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  recommendationsScrollLockDepth += 1;
}

function unlockRecommendationBodyScroll() {
  if (recommendationsScrollLockDepth === 0) {
    return;
  }

  recommendationsScrollLockDepth -= 1;
  if (recommendationsScrollLockDepth > 0) {
    return;
  }

  document.documentElement.classList.remove('recommendations-modal-open');
  document.body.classList.remove('recommendations-modal-open', 'u-lock-scroll', 'is-modal-open');
  document.documentElement.style.overflow = recommendationsPreviousHtmlOverflow;
  document.body.style.overflow = recommendationsPreviousBodyOverflow;
  document.body.style.position = recommendationsPreviousBodyPosition;
  document.body.style.top = recommendationsPreviousBodyTop;
  document.body.style.left = recommendationsPreviousBodyLeft;
  document.body.style.right = recommendationsPreviousBodyRight;
  document.body.style.width = recommendationsPreviousBodyWidth;
  document.body.style.paddingRight = recommendationsPreviousBodyPaddingRight;
  if (recommendationsScrollPositionBeforeLock > 0) {
    window.scrollTo(0, recommendationsScrollPositionBeforeLock);
  }

  recommendationsScrollPositionBeforeLock = 0;
  recommendationsPreviousHtmlOverflow = '';
  recommendationsPreviousBodyPosition = '';
  recommendationsPreviousBodyTop = '';
  recommendationsPreviousBodyLeft = '';
  recommendationsPreviousBodyRight = '';
  recommendationsPreviousBodyWidth = '';
  recommendationsPreviousBodyPaddingRight = '';
}

function handleRecommendationModalKeydown(event) {
  if (!isRecommendationModalOpen()) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeRecommendationDetailModal();
    return;
  }

  if (event.key === 'PageDown' || event.key === 'PageUp') {
    const dialog = getRecommendationModalDialog();
    if (!(dialog instanceof HTMLElement) || dialog.scrollHeight <= dialog.clientHeight) {
      return;
    }

    event.preventDefault();
    const direction = event.key === 'PageDown' ? 1 : -1;
    dialog.scrollBy({
      top: direction * dialog.clientHeight,
      behavior: 'auto',
    });
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getRecommendationFocusableElements();
  const dialog = getRecommendationModalDialog();
  if (focusableElements.length === 0) {
    event.preventDefault();
    if (dialog instanceof HTMLElement) {
      dialog.focus({ preventScroll: true });
    }
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (event.shiftKey) {
    if (activeElement === firstElement || !activeElement || !dialog?.contains(activeElement)) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
    }
    return;
  }

  if (activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
}

function initRecommendationModalBehavior() {
  const modal = getRecommendationDetailModal();
  if (!(modal instanceof HTMLElement) || modal.dataset.recommendationModalInit === 'true') {
    return;
  }

  modal.dataset.recommendationModalInit = 'true';
  modal.addEventListener('keydown', handleRecommendationModalKeydown);
  modal.addEventListener('wheel', handleRecommendationModalWheel, { passive: false });
  modal.addEventListener('touchstart', handleRecommendationModalTouchStart, { passive: true });
  modal.addEventListener('touchmove', handleRecommendationModalTouchMove, { passive: false });
  modal.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('.modal-close') || target.classList.contains('modal-overlay')) {
      event.preventDefault();
      closeRecommendationDetailModal();
    }
  });
}

function initRecommendationGridBehavior() {
  const grid = document.getElementById('recommendationsGrid');
  if (!(grid instanceof HTMLElement) || grid.dataset.recommendationGridInit === 'true') {
    return;
  }

  grid.dataset.recommendationGridInit = 'true';
  grid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const card = target.closest('.recommendation-home-card');
    if (!(card instanceof HTMLElement)) {
      return;
    }

    if (target.closest('.ce-save-star') || target.closest('.rec-card-promo-toggle')) {
      return;
    }

    const recommendationId = card.dataset.recId || '';
    if (!recommendationId) {
      return;
    }

    event.preventDefault();
    void openRecommendationDetailModal(recommendationId);
  });

  grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const card = target.closest('.recommendation-home-card');
    if (!(card instanceof HTMLElement)) {
      return;
    }

    const recommendationId = card.dataset.recId || '';
    if (!recommendationId) {
      return;
    }

    event.preventDefault();
    void openRecommendationDetailModal(recommendationId);
  });
}

function initRecommendationsPage() {
  if (recommendationsInitialized) return;
  recommendationsInitialized = true;

  console.log('🔵 Recommendations page: Initializing...');
  initRecommendationModalBehavior();
  initRecommendationGridBehavior();
  loadData();
  setupLanguageListener();
  subscribeToSavedCatalog();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRecommendationsPage);
} else {
  initRecommendationsPage();
}

function subscribeToSavedCatalog() {
  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.subscribe === 'function') {
      window.CE_SAVED_CATALOG.subscribe(() => {
        if (recommendationsSavedOnly) {
          renderCategoryFilters();
          renderRecommendations();
        }
      });
    }
  } catch (_) {}
}

function setupLanguageListener() {
  window.addEventListener('languageChanged', () => {
    if (!allRecommendations.length) return;
    renderCategoryFilters();
    renderRecommendations();
  });

  document.addEventListener('wakacjecypr:languagechange', () => {
    if (!allRecommendations.length) return;
    renderCategoryFilters();
    renderRecommendations();
  });
}

function getCurrentLanguage() {
  const i18n = window.appI18n || {};
  return i18n.language || document.documentElement.lang || 'pl';
}

function t(key, fallback) {
  try {
    const i18n = window.appI18n || {};
    const lang = i18n.language || document.documentElement.lang || 'pl';
    const translations = (i18n.translations && i18n.translations[lang]) || {};
    const entry = translations[key];
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') {
      if (typeof entry.text === 'string') return entry.text;
      if (typeof entry.html === 'string') return entry.html;
    }
  } catch (error) {
    console.warn('recommendations.t error', error);
  }
  return fallback;
}

function getRecommendationMediaDisplayUrl(url) {
  if (window.CE_MEDIA_VIEWER?.getDisplayUrl) {
    return window.CE_MEDIA_VIEWER.getDisplayUrl(url);
  }
  return String(url || '').split('#')[0];
}

function isRecommendationPanorama(url) {
  if (window.CE_MEDIA_VIEWER?.isPanorama) {
    return window.CE_MEDIA_VIEWER.isPanorama(url);
  }
  return false;
}

function clearRecommendationPanoramaHint() {
  if (typeof recommendationsModalPanoramaHintCleanup === 'function') {
    try {
      recommendationsModalPanoramaHintCleanup();
    } catch (_) {
      // ignore cleanup errors
    }
  }
  recommendationsModalPanoramaHintCleanup = null;
}

function showRecommendationPanoramaHint(container, lang) {
  const hint = document.getElementById('recModalPanoramaHint');
  if (!container || !hint) return;

  clearRecommendationPanoramaHint();
  hint.textContent = lang === 'en'
    ? 'This is a 360° photo. Drag to look around. Tap once to start.'
    : 'To zdjęcie 360°. Przeciągnij, aby się rozejrzeć. Dotknij raz, aby zacząć.';
  hint.hidden = false;
  requestAnimationFrame(() => hint.classList.add('is-visible'));

  const dismiss = () => {
    hint.classList.remove('is-visible');
    hint.hidden = true;
  };

  container.addEventListener('pointerdown', dismiss, { once: true });
  recommendationsModalPanoramaHintCleanup = () => {
    container.removeEventListener('pointerdown', dismiss);
    dismiss();
  };
}

function clearRecommendationModalPanorama() {
  clearRecommendationPanoramaHint();
  const pano = document.getElementById('recModalPanorama');
  if (!pano) return;

  if (typeof recommendationsModalPanoramaCleanup === 'function') {
    try {
      recommendationsModalPanoramaCleanup();
    } catch (_) {
      // ignore cleanup errors
    }
  } else if (window.CE_MEDIA_VIEWER?.destroyPanorama) {
    window.CE_MEDIA_VIEWER.destroyPanorama(pano);
  }

  recommendationsModalPanoramaCleanup = null;
  pano.hidden = true;
  pano.dataset.cePanoramaActive = '0';
}

function refreshSavedButtons(root) {
  try {
    if (window.CE_SAVED_CATALOG && typeof window.CE_SAVED_CATALOG.refreshButtons === 'function') {
      window.CE_SAVED_CATALOG.refreshButtons(root || document);
    }
  } catch (_) {}
}

async function loadData() {
  try {
    console.log('🔵 Loading recommendations data...');

    const loadingEl = document.getElementById('loadingState');
    const emptyEl = document.getElementById('emptyState');
    if (!loadingEl || !emptyEl) {
      console.error('❌ Missing DOM elements: loadingState or emptyState');
      return;
    }

    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';

    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data: cats, error: catError } = await supabase
      .from('recommendation_categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (catError) throw catError;
    allCategories = cats || [];

    const { data: recs, error: recError } = await supabase
      .from('recommendations')
      .select('*, recommendation_categories(name_pl, name_en, icon, color)')
      .eq('active', true)
      .order('featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (recError) throw recError;
    allRecommendations = recs || [];

    loadingEl.style.display = 'none';

    if (allRecommendations.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    renderCategoryFilters();
    renderRecommendations();
    maybeOpenRecommendationDeepLink();
  } catch (error) {
    console.error('❌ Error loading recommendations:', error);
    const loadingEl = document.getElementById('loadingState');
    if (loadingEl) {
      const title = t('recommendations.error.title', 'Nie udało się załadować rekomendacji');
      const message = error && error.message
        ? error.message
        : t('recommendations.error.message', 'Coś poszło nie tak. Spróbuj ponownie później.');
      const retry = t('recommendations.error.retry', 'Spróbuj ponownie');
      loadingEl.innerHTML = `
        <div style="color: #ef4444; text-align: center;">
          <p>${title}</p>
          <p style="font-size: 0.875rem; color: #666; margin-top: 8px;">${message}</p>
          <button class="btn" onclick="location.reload()">${retry}</button>
        </div>
      `;
    }
  }
}

function setClearFiltersVisibility() {
  const clearBtn = document.getElementById('clearFilters');
  if (!clearBtn) return;
  clearBtn.style.display = currentCategoryFilter || recommendationsSavedOnly ? 'block' : 'none';
}

function renderCategoryFilters() {
  const container = document.getElementById('categoriesFilters');
  if (!container) {
    console.error('❌ Element #categoriesFilters not found');
    return;
  }

  container.innerHTML = '';
  const lang = getCurrentLanguage();

  const allLabel = lang === 'en' ? 'All' : 'Wszystkie';
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'recommendations-home-tab ce-home-pill' + (!currentCategoryFilter ? ' active' : '');
  allBtn.dataset.category = '';
  allBtn.textContent = allLabel;
  allBtn.onclick = () => filterByCategory('');
  container.appendChild(allBtn);

  let visibleCount = 0;
  allCategories.forEach((cat) => {
    const count = allRecommendations.filter((rec) => rec.category_id === cat.id).length;
    if (count === 0) return;

    visibleCount += 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recommendations-home-tab ce-home-pill' + (currentCategoryFilter === cat.id ? ' active' : '');
    btn.dataset.category = cat.id;
    const label = lang === 'en'
      ? (cat.name_en || cat.name_pl)
      : (cat.name_pl || cat.name_en);
    btn.textContent = `${cat.icon || '📍'} ${label}`;
    btn.onclick = () => filterByCategory(cat.id);
    container.appendChild(btn);
  });

  const savedLabel = lang === 'en' ? 'Saved' : 'Zapisane';
  const savedStar = recommendationsSavedOnly ? '★' : '☆';
  const savedBtn = document.createElement('button');
  savedBtn.type = 'button';
  savedBtn.className = 'recommendations-home-tab ce-home-pill' + (recommendationsSavedOnly ? ' active' : '');
  savedBtn.dataset.filter = 'saved';
  savedBtn.setAttribute('aria-pressed', recommendationsSavedOnly ? 'true' : 'false');
  savedBtn.textContent = `${savedLabel} ${savedStar}`;
  savedBtn.onclick = () => toggleSavedFilter();
  container.appendChild(savedBtn);

  setClearFiltersVisibility();
  console.log('✅ Rendered recommendation filters:', visibleCount, 'categories');
}

function filterByCategory(categoryId) {
  currentCategoryFilter = categoryId;
  renderCategoryFilters();
  renderRecommendations();
}

function toggleSavedFilter() {
  const uid = window.CE_STATE?.session?.user?.id ? String(window.CE_STATE.session.user.id) : '';
  const isAuthed = !!uid || document.documentElement?.dataset?.authState === 'authenticated';

  if (!isAuthed) {
    try {
      const openSavedAuth = window.CE_SAVED_CATALOG && window.CE_SAVED_CATALOG.openAuthModal;
      if (typeof openSavedAuth === 'function') {
        openSavedAuth('login');
      } else if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
      }
    } catch (_) {}
    return;
  }

  if (!recommendationsSavedOnly) {
    try {
      const syncFn = window.CE_SAVED_CATALOG && window.CE_SAVED_CATALOG.syncForCurrentUser;
      if (typeof syncFn === 'function') {
        void Promise.resolve(syncFn()).finally(() => {
          recommendationsSavedOnly = true;
          renderCategoryFilters();
          renderRecommendations();
        });
        return;
      }
    } catch (_) {}
  }

  recommendationsSavedOnly = !recommendationsSavedOnly;
  renderCategoryFilters();
  renderRecommendations();
}

window.clearFilters = function clearFilters() {
  currentCategoryFilter = '';
  recommendationsSavedOnly = false;
  renderCategoryFilters();
  renderRecommendations();
};

function getFilteredRecommendations() {
  let filtered = allRecommendations;

  if (currentCategoryFilter) {
    filtered = filtered.filter((rec) => rec.category_id === currentCategoryFilter);
  }

  if (recommendationsSavedOnly) {
    const api = window.CE_SAVED_CATALOG;
    if (api && typeof api.isSaved === 'function') {
      filtered = filtered.filter((rec) => api.isSaved('recommendation', String(rec?.id || '')));
    } else {
      filtered = [];
    }
  }

  return filtered;
}

function renderRecommendations() {
  const grid = document.getElementById('recommendationsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) {
    console.error('❌ Element #recommendationsGrid not found');
    return;
  }

  const filtered = getFilteredRecommendations();
  console.log('🔵 Rendering recommendations:', filtered.length, 'items');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  grid.innerHTML = filtered.map((rec) => createRecommendationCard(rec)).join('');
  attachPromoCodeHandlers(grid);
  refreshSavedButtons(grid);
}

async function ensureLoggedIn(onAuthenticated) {
  try {
    let session = null;
    if (typeof waitForAuthReady === 'function') {
      const maybeSession = await waitForAuthReady();
      if (maybeSession && maybeSession.user) {
        session = maybeSession;
      }
    }

    const state = window.CE_STATE || {};
    if (state.session && state.session.user) {
      session = state.session;
    }

    const isLoggedIn = !!(session && session.user);
    if (isLoggedIn) {
      if (typeof onAuthenticated === 'function') {
        onAuthenticated(session);
      }
      return true;
    }

    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    } else {
      const opener = document.querySelector('[data-open-auth]');
      if (opener instanceof HTMLElement) {
        opener.click();
      } else {
        console.warn('[recommendations] Auth opener not found for promo code gate.');
      }
    }
    return false;
  } catch (error) {
    console.warn('[recommendations] Error while checking auth state for promo code gate.', error);
    return false;
  }
}

function attachPromoCodeHandlers(root) {
  if (!root) return;
  const buttons = root.querySelectorAll('.rec-card-promo-toggle');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.dataset.promoReady === 'true') return;
    btn.dataset.promoReady = 'true';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlePromoToggleClick(btn);
    });
  });
}

function handlePromoToggleClick(button) {
  if (!(button instanceof HTMLButtonElement)) return;

  const promoCode = button.dataset.promoCode || '';
  const recId = button.dataset.recId || '';
  if (!promoCode) return;

  void ensureLoggedIn(() => {
    const promoContainer = button.closest('.rec-card-promo');
    if (!(promoContainer instanceof HTMLElement)) return;

    const codeEl = promoContainer.querySelector('.rec-card-promo-code');
    if (!(codeEl instanceof HTMLElement)) return;
    if (codeEl.dataset.promoVisible === 'true') return;

    if (recId) {
      trackClick(recId, 'promo_code');
    }

    codeEl.textContent = promoCode;
    codeEl.dataset.promoVisible = 'true';
  });
}

function createPromoSection(rec, lang, options = {}) {
  const discount = options.discount;
  if (!rec || !rec.promo_code || !discount) {
    return '';
  }

  const showCodeLabel = lang === 'en' ? 'Show code' : 'Pokaż kod';
  return `
    <div class="rec-card-promo">
      <div class="rec-card-promo-label">${discount}</div>
      <div class="rec-card-promo-code" data-promo-visible="false"></div>
      <button type="button" class="rec-btn rec-btn-secondary rec-card-promo-toggle" data-promo-code="${rec.promo_code}" data-rec-id="${rec.id}">
        ${showCodeLabel}
      </button>
    </div>
  `;
}

function createRecommendationCard(rec) {
  const category = rec.recommendation_categories || {};
  const lang = getCurrentLanguage();
  const saveLabel = lang === 'en' ? 'Save' : 'Zapisz';

  const title = lang === 'en'
    ? (rec.title_en || rec.title_pl || 'Untitled')
    : (rec.title_pl || rec.title_en || 'Bez tytułu');

  const featuredLabel = lang === 'en' ? 'Recommended' : 'Polecane';
  const categoryLabel = lang === 'en'
    ? (category.name_en || category.name_pl || 'General')
    : (category.name_pl || category.name_en || 'Ogólne');
  const subtitle = rec.location_name ? `${rec.location_name} • ${categoryLabel}` : categoryLabel;
  const imageRaw = String(rec.image_url || '').trim();
  const imageDisplay = getRecommendationMediaDisplayUrl(imageRaw);
  const imageIsPanorama = isRecommendationPanorama(imageRaw);

  return `
    <div
      class="recommendation-home-card"
      role="button"
      tabindex="0"
      data-rec-id="${String(rec.id || '')}"
    >
      ${rec.featured ? `<div class="ce-home-featured-badge">⭐ ${featuredLabel}</div>` : ''}
      <button
        type="button"
        class="ce-save-star ce-save-star-sm ce-home-card-star"
        data-ce-save="1"
        data-item-type="recommendation"
        data-ref-id="${String(rec.id || '')}"
        aria-label="${saveLabel}"
        title="${saveLabel}"
        onclick="event.preventDefault(); event.stopPropagation();"
      >☆</button>

      ${imageRaw
        ? `
          ${imageIsPanorama ? `<div class="rec-panorama-badge rec-panorama-badge--home">360°</div>` : ''}
          <img src="${imageDisplay}" alt="${title}" loading="lazy" class="ce-home-card-image" />
        `
        : '<div class="ce-home-card-image ce-home-card-image--placeholder"></div>'
      }

      <div class="ce-home-card-overlay">
        <h3 class="ce-home-card-title">${title}</h3>
        <p class="ce-home-card-subtitle">${subtitle}</p>
      </div>
    </div>
  `;
}

async function openRecommendationDetailModal(id) {
  const rec = allRecommendations.find((item) => item.id === id);
  if (!rec) return;

  const category = rec.recommendation_categories || {};
  const lang = getCurrentLanguage();

  const title = lang === 'en'
    ? (rec.title_en || rec.title_pl)
    : (rec.title_pl || rec.title_en);

  const description = lang === 'en'
    ? (rec.description_en || rec.description_pl)
    : (rec.description_pl || rec.description_en);

  const discount = lang === 'en'
    ? (rec.discount_text_en || rec.discount_text_pl)
    : (rec.discount_text_pl || rec.discount_text_en);

  const offer = lang === 'en'
    ? (rec.offer_text_en || rec.offer_text_pl)
    : (rec.offer_text_pl || rec.offer_text_en);

  const categoryName = lang === 'en'
    ? (category.name_en || category.name_pl)
    : (category.name_pl || category.name_en);
  const saveLabel = lang === 'en' ? 'Save' : 'Zapisz';

  const imageUrlRaw = String(rec.image_url || '').trim();
  const imageUrl = getRecommendationMediaDisplayUrl(imageUrlRaw);
  const imageIsPanorama = isRecommendationPanorama(imageUrlRaw);
  const canRenderPanorama = Boolean(imageIsPanorama && window.CE_MEDIA_VIEWER?.mountPanorama);

  const openMapLabel = lang === 'en' ? 'Open in maps' : 'Otwórz w mapach';
  const visitSiteLabel = lang === 'en' ? 'Visit website' : 'Strona www';

  const modalDetails = document.getElementById('modalDetails');
  if (!modalDetails) return;

  modalDetails.innerHTML = `
    ${imageUrlRaw ? `
      <div class="rec-modal-media">
        <img src="${imageUrl}" alt="${title}" class="rec-modal-image" ${canRenderPanorama ? 'hidden' : ''} />
        <div id="recModalPanorama" class="rec-modal-panorama" ${canRenderPanorama ? '' : 'hidden'}></div>
        <div id="recModalPanoramaHint" class="rec-modal-panorama-hint" hidden></div>
      </div>
    ` : ''}

    <div class="rec-modal-content-section">
      <div class="rec-card-category" style="margin-bottom: 16px;">
        <span>${category.icon || '📍'}</span>
        <span>${categoryName || 'General'}</span>
      </div>

      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin: 0 0 16px;">
        <h1 id="detailModalTitle" style="font-size: 2.25rem; font-weight: 700; margin: 0; color: #111827;">${title}</h1>
        <button
          type="button"
          class="ce-save-star ce-save-star-sm"
          data-ce-save="1"
          data-item-type="recommendation"
          data-ref-id="${String(rec.id || '')}"
          aria-label="${saveLabel}"
          title="${saveLabel}"
          onclick="event.preventDefault(); event.stopPropagation();"
        >☆</button>
      </div>

      ${rec.location_name ? `
        <div style="display: flex; align-items: center; gap: 8px; color: #6b7280; margin-bottom: 24px; font-size: 16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${rec.location_name}
        </div>
      ` : ''}

      ${description ? `
        <p style="font-size: 17px; line-height: 1.8; color: #374151; margin-bottom: 24px;">${description}</p>
      ` : ''}

      ${offer ? `
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #22c55e; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <strong style="color: #16a34a; font-size: 16px; display: block; margin-bottom: 8px;">🎁 Special Offer</strong>
          <p style="margin: 0; color: #166534; font-size: 15px; line-height: 1.6;">${offer}</p>
        </div>
      ` : ''}

      ${createPromoSection(rec, lang, { discount })}

      <div class="rec-card-actions" style="margin-bottom: 32px; gap: 16px;">
        ${rec.google_url ? `
          <a href="${rec.google_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-primary" onclick="trackClick('${rec.id}', 'google');">
            🗺️ ${openMapLabel}
          </a>
        ` : ''}

        ${rec.website_url ? `
          <a href="${rec.website_url}" target="_blank" rel="noopener" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'website');">
            🌐 ${visitSiteLabel}
          </a>
        ` : ''}

        ${rec.phone ? `
          <a href="tel:${rec.phone}" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'phone');">
            📞 ${rec.phone}
          </a>
        ` : ''}

        ${rec.email ? `
          <a href="mailto:${rec.email}" class="rec-btn rec-btn-secondary" onclick="trackClick('${rec.id}', 'email');">
            ✉️ ${rec.email}
          </a>
        ` : ''}
      </div>

      ${rec.latitude && rec.longitude ? `
        <div id="modalMap" class="rec-modal-map"></div>
      ` : ''}
    </div>
  `;

  attachPromoCodeHandlers(modalDetails);
  refreshSavedButtons(modalDetails);

  const modal = document.getElementById('detailModal');
  if (modal) {
    const wasClosed = !isRecommendationModalOpen();
    if (wasClosed) {
      recommendationsModalPreviouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    if (wasClosed) {
      lockRecommendationBodyScroll();
    }

    const dialog = getRecommendationModalDialog();
    if (dialog instanceof HTMLElement) {
      dialog.scrollTop = 0;
    }

    requestAnimationFrame(() => {
      focusRecommendationModal();
    });
  }

  clearRecommendationModalPanorama();
  if (canRenderPanorama) {
    const panoramaContainer = document.getElementById('recModalPanorama');
    if (panoramaContainer && window.CE_MEDIA_VIEWER?.mountPanorama) {
      try {
        const mounted = await window.CE_MEDIA_VIEWER.mountPanorama(panoramaContainer, imageUrlRaw);
        if (mounted?.isPanorama) {
          recommendationsModalPanoramaCleanup = mounted.destroy;
          showRecommendationPanoramaHint(panoramaContainer, lang);
        }
      } catch (error) {
        console.warn('Recommendation panorama mount failed:', error);
        const imageEl = modalDetails.querySelector('.rec-modal-image');
        if (imageEl) imageEl.hidden = false;
        panoramaContainer.hidden = true;
        panoramaContainer.dataset.cePanoramaActive = '0';
      }
    }
  }

  trackView(rec.id);

  if (rec.latitude && rec.longitude && typeof L !== 'undefined') {
    setTimeout(() => {
      try {
        const mapEl = document.getElementById('modalMap');
        if (!mapEl) return;

        const map = L.map('modalMap').setView([rec.latitude, rec.longitude], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        const marker = L.marker([rec.latitude, rec.longitude]).addTo(map);
        if (title) marker.bindPopup(title);
      } catch (error) {
        console.error('Map error:', error);
      }
    }, 200);
  }
}

window.openRecommendationsDetailModal = openRecommendationDetailModal;
window.closeRecommendationsDetailModal = closeRecommendationDetailModal;

window.trackView = async function trackView(recId) {
  if (!supabase) return;
  try {
    await supabase.from('recommendation_views').insert([{ recommendation_id: recId }]);
    console.log('✅ View tracked:', recId);
  } catch (error) {
    console.error('Track view error:', error);
  }
};

window.trackClick = async function trackClick(recId, type) {
  if (!supabase) return;
  try {
    await supabase.from('recommendation_clicks').insert([{
      recommendation_id: recId,
      click_type: type,
    }]);
    console.log('✅ Click tracked:', recId, type);
  } catch (error) {
    console.error('Track click error:', error);
  }
};
