/**
 * SOS Modal Module
 * Obsługuje wyświetlanie i zamykanie modala z informacjami alarmowymi
 */

console.log('🚨 SOS Module loaded');

(function() {
  'use strict';

  // Funkcje zarządzania scrollem
  let scrollPositionBeforeLock = 0;
  let bodyScrollLockCount = 0;
  let previousBodyOverflow = '';
  let previousBodyPosition = '';
  let previousBodyTop = '';
  let previousBodyWidth = '';

  function lockBodyScroll() {
    if (bodyScrollLockCount === 0) {
      scrollPositionBeforeLock = window.scrollY || window.pageYOffset || 0;
      previousBodyOverflow = document.body.style.overflow;
      previousBodyPosition = document.body.style.position;
      previousBodyTop = document.body.style.top;
      previousBodyWidth = document.body.style.width;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionBeforeLock}px`;
      document.body.style.width = '100%';
    }

    bodyScrollLockCount += 1;
  }

  function unlockBodyScroll() {
    if (bodyScrollLockCount === 0) return;

    bodyScrollLockCount -= 1;
    if (bodyScrollLockCount > 0) {
      return;
    }

    document.body.style.overflow = previousBodyOverflow;
    document.body.style.position = previousBodyPosition;
    document.body.style.top = previousBodyTop;
    document.body.style.width = previousBodyWidth;

    if (scrollPositionBeforeLock > 0) {
      window.scrollTo(0, scrollPositionBeforeLock);
    }

    scrollPositionBeforeLock = 0;
  }

  // Elementy DOM
  let sosModal = null;
  let sosDialog = null;
  let sosClose = null;
  let sosToggleButtons = null;
  let sosPreviouslyFocusedElement = null;

  // Selektory dla fokusowanych elementów
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  // Funkcje pomocnicze
  function getSosFocusableElements() {
    if (!sosModal) return [];
    const container = sosDialog ?? sosModal;
    return Array.from(container.querySelectorAll(focusableSelectors)).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      return element.offsetParent !== null || style.position === 'fixed';
    });
  }

  function focusFirstElementInSos() {
    if (!sosModal) return;
    const focusableElements = getSosFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus({ preventScroll: true });
      return;
    }
    if (sosDialog instanceof HTMLElement) {
      sosDialog.focus({ preventScroll: true });
    }
  }

  function handleSosKeydown(event) {
    if (!sosModal || sosModal.hidden || !sosModal.classList.contains('visible')) {
      return;
    }

    if (event.key === 'PageDown' || event.key === 'PageUp') {
      if (!(sosDialog instanceof HTMLElement)) {
        return;
      }

      if (sosDialog.scrollHeight <= sosDialog.clientHeight) {
        return;
      }

      event.preventDefault();
      const direction = event.key === 'PageDown' ? 1 : -1;
      sosDialog.scrollBy({
        top: direction * sosDialog.clientHeight,
        behavior: 'auto',
      });
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getSosFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      if (sosDialog instanceof HTMLElement) {
        sosDialog.focus({ preventScroll: true });
      }
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (event.shiftKey) {
      if (activeElement === firstElement || !activeElement || !sosModal.contains(activeElement)) {
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

  function finalizeSosClose() {
    if (!sosModal) return;
    sosModal.hidden = true;
    unlockBodyScroll();
    if (sosPreviouslyFocusedElement instanceof HTMLElement) {
      sosPreviouslyFocusedElement.focus({ preventScroll: true });
    }
    sosPreviouslyFocusedElement = null;
  }

  function openSosModal(triggerElement) {
    console.log('🚨 openSosModal called, sosModal:', sosModal);
    if (!sosModal) {
      console.error('❌ SOS Modal not found!');
      return;
    }
    if (!sosModal.hidden && sosModal.classList.contains('visible')) {
      console.log('ℹ️ SOS Modal already visible');
      return;
    }

    if (triggerElement instanceof HTMLElement) {
      sosPreviouslyFocusedElement = triggerElement;
    } else if (document.activeElement instanceof HTMLElement) {
      sosPreviouslyFocusedElement = document.activeElement;
    } else {
      sosPreviouslyFocusedElement = null;
    }

    lockBodyScroll();
    sosModal.hidden = false;
    requestAnimationFrame(() => {
      sosModal.classList.add('visible');
      focusFirstElementInSos();
    });
    
    console.log('✅ SOS Modal opened');
  }

  function closeSosModal() {
    if (!sosModal) return;
    const wasVisible = sosModal.classList.contains('visible');
    sosModal.classList.remove('visible');

    if (!wasVisible) {
      finalizeSosClose();
      return;
    }

    const handleTransitionEnd = (event) => {
      if (event.target !== sosModal) return;
      sosModal.removeEventListener('transitionend', handleTransitionEnd);
      finalizeSosClose();
    };

    sosModal.addEventListener('transitionend', handleTransitionEnd);

    setTimeout(() => {
      if (sosModal && !sosModal.classList.contains('visible')) {
        sosModal.removeEventListener('transitionend', handleTransitionEnd);
        finalizeSosClose();
      }
    }, 320);
    
    console.log('✅ SOS Modal closed');
  }

  // Inicjalizacja po załadowaniu DOM
  function initSosModal() {
    console.log('🔄 Initializing SOS Modal...');
    
    sosModal = document.getElementById('sosModal');
    sosDialog = sosModal?.querySelector('.sos-dialog');
    sosClose = document.getElementById('sosClose');
    sosToggleButtons = document.querySelectorAll('[aria-controls="sosModal"]');
    
    console.log('📊 SOS Elements found:', {
      modal: !!sosModal,
      dialog: !!sosDialog,
      close: !!sosClose,
      buttons: sosToggleButtons.length
    });

    if (!sosModal) {
      console.error('❌ SOS Modal element (#sosModal) not found in DOM');
      return;
    }

    if (sosToggleButtons.length === 0) {
      console.warn('⚠️ No SOS toggle buttons found ([aria-controls="sosModal"])');
    }

    // Dodaj event listeners dla przycisków SOS
    sosToggleButtons.forEach((button, index) => {
      console.log(`🔘 Adding click listener to SOS button ${index + 1}:`, button.id || button.className);
      button.addEventListener('click', (event) => {
        console.log('🚨 SOS button clicked!');
        event.preventDefault();
        event.stopPropagation();
        const trigger = event.currentTarget;
        if (trigger instanceof HTMLElement) {
          openSosModal(trigger);
          return;
        }
        openSosModal();
      });
    });

    // Dodaj event listener dla przycisku zamykania
    sosClose?.addEventListener('click', () => {
      console.log('❌ SOS close button clicked');
      closeSosModal();
    });

    // Zamknij modal po kliknięciu w tło
    sosModal.addEventListener('click', (event) => {
      if (event.target === sosModal) {
        console.log('🖱️ Clicked on modal backdrop');
        closeSosModal();
      }
    });

    // Dodaj obsługę klawiatury dla modala
    sosModal.addEventListener('keydown', handleSosKeydown);

    // Dodaj globalną obsługę klawisza Escape
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      
      if (sosModal && !sosModal.hidden) {
        console.log('⌨️ Escape pressed - closing SOS modal');
        closeSosModal();
      }
    });

    console.log('✅ SOS Modal initialized successfully');
  }

  // Uruchom inicjalizację po załadowaniu DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSosModal);
  } else {
    initSosModal();
  }

})();
