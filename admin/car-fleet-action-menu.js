(function registerCarFleetActionMenu(root) {
  'use strict';

  const DEFAULT_GAP = 6;
  const DEFAULT_PADDING = 8;
  const DEFAULT_Z_INDEX = 10000;
  const DEFAULT_ITEM_SELECTOR = '[role="menuitem"]';
  const PORTAL_ATTRIBUTE = 'data-car-fleet-action-menu-portal';
  let activeController = null;
  let generatedMenuId = 0;

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function nonNegativeNumber(value, fallback = 0) {
    return Math.max(0, finiteNumber(value, fallback));
  }

  function clamp(value, minimum, maximum) {
    if (maximum < minimum) return minimum;
    return Math.min(Math.max(value, minimum), maximum);
  }

  function normalizeRect(rect = {}) {
    const left = finiteNumber(rect.left, 0);
    const top = finiteNumber(rect.top, 0);
    const width = nonNegativeNumber(rect.width, finiteNumber(rect.right, left) - left);
    const height = nonNegativeNumber(rect.height, finiteNumber(rect.bottom, top) - top);
    return Object.freeze({
      left,
      top,
      right: finiteNumber(rect.right, left + width),
      bottom: finiteNumber(rect.bottom, top + height),
      width,
      height,
    });
  }

  function calculateCollisionPosition(options = {}) {
    const anchor = normalizeRect(options.anchorRect);
    const menu = normalizeRect(options.menuRect || options.menuSize);
    const viewportWidth = nonNegativeNumber(options.viewportWidth, 0);
    const viewportHeight = nonNegativeNumber(options.viewportHeight, 0);
    const padding = nonNegativeNumber(options.padding, DEFAULT_PADDING);
    const gap = nonNegativeNumber(options.gap, DEFAULT_GAP);
    const preferredPlacement = options.preferredPlacement === 'top' ? 'top' : 'bottom';
    const align = ['start', 'center', 'end'].includes(options.align) ? options.align : 'end';
    const safeWidth = Math.max(0, viewportWidth - (padding * 2));
    const safeHeight = Math.max(0, viewportHeight - (padding * 2));
    const renderedWidth = Math.min(menu.width, safeWidth);
    const availableBelow = Math.max(0, viewportHeight - padding - anchor.bottom - gap);
    const availableAbove = Math.max(0, anchor.top - padding - gap);
    const fitsBelow = menu.height <= availableBelow;
    const fitsAbove = menu.height <= availableAbove;
    let placement = preferredPlacement;

    if (preferredPlacement === 'bottom') {
      if (!fitsBelow && (fitsAbove || availableAbove > availableBelow)) placement = 'top';
    } else if (!fitsAbove && (fitsBelow || availableBelow >= availableAbove)) {
      placement = 'bottom';
    }

    const availableHeight = placement === 'top' ? availableAbove : availableBelow;
    const renderedHeight = Math.min(menu.height, availableHeight, safeHeight);
    let left = anchor.right - renderedWidth;
    if (align === 'start') left = anchor.left;
    if (align === 'center') left = anchor.left + ((anchor.width - renderedWidth) / 2);
    left = clamp(left, padding, viewportWidth - padding - renderedWidth);

    let top = placement === 'top'
      ? anchor.top - gap - renderedHeight
      : anchor.bottom + gap;
    top = clamp(top, padding, viewportHeight - padding - renderedHeight);

    return Object.freeze({
      left,
      top,
      placement,
      maxWidth: safeWidth,
      maxHeight: Math.max(0, Math.min(availableHeight, safeHeight)),
      availableAbove,
      availableBelow,
      clippedHorizontally: menu.width > safeWidth,
      clippedVertically: menu.height > availableHeight,
    });
  }

  function getAttribute(element, name) {
    return element?.getAttribute?.(name);
  }

  function setOrRemoveAttribute(element, name, value) {
    if (!element) return;
    if (value === null || value === undefined) element.removeAttribute?.(name);
    else element.setAttribute?.(name, String(value));
  }

  function isDisabledMenuItem(item) {
    return Boolean(
      item?.disabled
      || item?.hidden
      || getAttribute(item, 'aria-disabled') === 'true'
      || getAttribute(item, 'hidden') !== null
    );
  }

  function defaultGetAction(item) {
    return String(
      getAttribute(item, 'data-action')
      || getAttribute(item, 'data-car-multicity-action')
      || getAttribute(item, 'data-fleet-availability-action')
      || ''
    ).trim();
  }

  function createBodyPortalController(options = {}) {
    const documentRef = options.document || root.document || null;
    const windowRef = options.window || root.window || root;
    const itemSelector = String(options.itemSelector || DEFAULT_ITEM_SELECTOR);
    const getAction = typeof options.getAction === 'function' ? options.getAction : defaultGetAction;
    const onAction = typeof options.onAction === 'function' ? options.onAction : null;
    const onOpen = typeof options.onOpen === 'function' ? options.onOpen : null;
    const onClose = typeof options.onClose === 'function' ? options.onClose : null;
    const gap = nonNegativeNumber(options.gap, DEFAULT_GAP);
    const padding = nonNegativeNumber(options.padding, DEFAULT_PADDING);
    const zIndex = finiteNumber(options.zIndex, DEFAULT_Z_INDEX);
    const preferredPlacement = options.preferredPlacement === 'top' ? 'top' : 'bottom';
    const align = ['start', 'center', 'end'].includes(options.align) ? options.align : 'end';
    let state = null;
    let destroyed = false;

    function getViewport() {
      const documentElement = documentRef?.documentElement;
      return {
        width: nonNegativeNumber(windowRef?.innerWidth, finiteNumber(documentElement?.clientWidth, 0)),
        height: nonNegativeNumber(windowRef?.innerHeight, finiteNumber(documentElement?.clientHeight, 0)),
      };
    }

    function getMenuItems(menu = state?.menu) {
      if (!menu?.querySelectorAll) return [];
      return Array.from(menu.querySelectorAll(itemSelector)).filter((item) => !isDisabledMenuItem(item));
    }

    function rememberItemTabIndexes(menu) {
      if (!menu?.querySelectorAll) return [];
      return Array.from(menu.querySelectorAll(itemSelector)).map((item) => ({
        item,
        tabindex: getAttribute(item, 'tabindex'),
      }));
    }

    function restoreItemTabIndexes(itemTabIndexes) {
      itemTabIndexes.forEach(({ item, tabindex }) => setOrRemoveAttribute(item, 'tabindex', tabindex));
    }

    function focusItem(index) {
      const items = getMenuItems();
      if (!items.length) return null;
      const normalizedIndex = ((index % items.length) + items.length) % items.length;
      items.forEach((item, itemIndex) => {
        item.tabIndex = itemIndex === normalizedIndex ? 0 : -1;
      });
      items[normalizedIndex].focus?.({ preventScroll: true });
      return items[normalizedIndex];
    }

    function reposition() {
      if (!state?.menu || !state?.trigger) return null;
      const menu = state.menu;
      const previousVisibility = menu.style.visibility;
      menu.style.visibility = 'hidden';
      menu.style.maxWidth = 'none';
      menu.style.maxHeight = 'none';
      menu.style.overflowY = 'visible';
      const viewport = getViewport();
      const firstMeasurement = normalizeRect(menu.getBoundingClientRect?.());
      const firstPosition = calculateCollisionPosition({
        anchorRect: state.trigger.getBoundingClientRect?.(),
        menuRect: firstMeasurement,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        gap,
        padding,
        preferredPlacement,
        align,
      });

      if (firstPosition.clippedHorizontally) menu.style.maxWidth = `${firstPosition.maxWidth}px`;
      const finalMeasurement = normalizeRect(menu.getBoundingClientRect?.());
      const position = calculateCollisionPosition({
        anchorRect: state.trigger.getBoundingClientRect?.(),
        menuRect: finalMeasurement,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        gap,
        padding,
        preferredPlacement,
        align,
      });

      menu.style.left = `${position.left}px`;
      menu.style.top = `${position.top}px`;
      menu.style.maxWidth = `${position.maxWidth}px`;
      menu.style.maxHeight = `${position.maxHeight}px`;
      menu.style.overflowY = position.clippedVertically ? 'auto' : 'visible';
      menu.style.visibility = previousVisibility === 'hidden' && !state.positioned ? 'hidden' : 'visible';
      menu.setAttribute?.('data-placement', position.placement);
      state.position = position;
      state.positioned = true;
      return position;
    }

    function restoreMenu(stateToRestore) {
      const { menu, originalParent, originalNextSibling } = stateToRestore;
      if (originalParent?.insertBefore && originalNextSibling?.parentNode === originalParent) {
        originalParent.insertBefore(menu, originalNextSibling);
      } else if (originalParent?.appendChild) {
        originalParent.appendChild(menu);
      } else {
        menu.remove?.();
      }
      setOrRemoveAttribute(menu, 'style', stateToRestore.originalStyle);
      setOrRemoveAttribute(menu, PORTAL_ATTRIBUTE, stateToRestore.originalPortalAttribute);
      setOrRemoveAttribute(menu, 'data-placement', stateToRestore.originalPlacementAttribute);
      if (stateToRestore.generatedId) menu.removeAttribute?.('id');
      menu.hidden = stateToRestore.originalHidden;
      restoreItemTabIndexes(stateToRestore.itemTabIndexes);
    }

    function close(reason = 'programmatic', closeOptions = {}) {
      if (!state) return false;
      const closingState = state;
      state = null;
      if (activeController === api) activeController = null;
      restoreMenu(closingState);
      setOrRemoveAttribute(closingState.trigger, 'aria-expanded', closingState.originalAriaExpanded);
      setOrRemoveAttribute(closingState.trigger, 'aria-controls', closingState.originalAriaControls);
      if (closingState.details && options.syncDetails !== false) closingState.details.open = false;
      const shouldRestoreFocus = closeOptions.restoreFocus !== false;
      if (shouldRestoreFocus && closingState.trigger?.isConnected !== false) {
        closingState.trigger.focus?.({ preventScroll: true });
      }
      onClose?.({
        reason,
        trigger: closingState.trigger,
        menu: closingState.menu,
        context: closingState.context,
        restoredFocus: shouldRestoreFocus,
      });
      return true;
    }

    function open(openOptions = {}) {
      if (destroyed) throw new Error('Car Fleet action menu controller has been destroyed.');
      const trigger = openOptions.trigger;
      const menu = openOptions.menu;
      if (!trigger?.getBoundingClientRect || !menu?.getBoundingClientRect) {
        throw new TypeError('A measurable trigger and menu are required.');
      }
      if (!documentRef?.body?.appendChild) {
        throw new TypeError('A document with a body is required.');
      }
      if (state?.trigger === trigger && state?.menu === menu) return api;
      if (activeController && activeController !== api) {
        activeController.close('superseded', { restoreFocus: false });
      }
      if (state) close('replaced', { restoreFocus: false });

      const originalId = getAttribute(menu, 'id');
      const menuId = originalId || `car-fleet-action-menu-${++generatedMenuId}`;
      const details = trigger.closest?.('details') || null;
      state = {
        trigger,
        menu,
        context: openOptions.context,
        details,
        originalParent: menu.parentNode || null,
        originalNextSibling: menu.nextSibling || null,
        originalStyle: getAttribute(menu, 'style'),
        originalPortalAttribute: getAttribute(menu, PORTAL_ATTRIBUTE),
        originalPlacementAttribute: getAttribute(menu, 'data-placement'),
        originalHidden: Boolean(menu.hidden),
        originalAriaExpanded: getAttribute(trigger, 'aria-expanded'),
        originalAriaControls: getAttribute(trigger, 'aria-controls'),
        itemTabIndexes: rememberItemTabIndexes(menu),
        generatedId: !originalId,
        positioned: false,
        position: null,
      };
      activeController = api;
      if (!originalId) menu.setAttribute?.('id', menuId);
      trigger.setAttribute?.('aria-expanded', 'true');
      trigger.setAttribute?.('aria-controls', menuId);
      if (details && options.syncDetails !== false) details.open = true;
      menu.hidden = false;
      menu.setAttribute?.(PORTAL_ATTRIBUTE, '');
      menu.style.position = 'fixed';
      menu.style.zIndex = String(zIndex);
      menu.style.right = 'auto';
      menu.style.bottom = 'auto';
      menu.style.left = '0px';
      menu.style.top = '0px';
      menu.style.visibility = 'hidden';
      menu.scrollTop = 0;
      documentRef.body.appendChild(menu);
      const position = reposition();
      menu.style.visibility = 'visible';
      if (openOptions.focus !== false) focusItem(0);
      onOpen?.({ trigger, menu, context: state.context, position });
      return api;
    }

    function toggle(openOptions = {}) {
      if (state?.trigger === openOptions.trigger && state?.menu === openOptions.menu) {
        close('toggle');
        return false;
      }
      open(openOptions);
      return true;
    }

    function handlePointerDown(event) {
      if (!state) return;
      const target = event?.target;
      if (state.menu.contains?.(target) || state.trigger.contains?.(target)) return;
      close('outside', { restoreFocus: false });
    }

    function handleClick(event) {
      if (!state) return;
      const item = event?.target?.closest?.(itemSelector);
      if (!item || !state.menu.contains?.(item) || isDisabledMenuItem(item)) return;
      const actionState = state;
      const result = onAction?.({
        action: getAction(item),
        item,
        trigger: actionState.trigger,
        menu: actionState.menu,
        context: actionState.context,
        originalEvent: event,
      });
      if (result === false || result?.keepOpen === true) return;
      const focusStayedInMenu = actionState.menu.contains?.(documentRef?.activeElement);
      close('action', { restoreFocus: result?.restoreFocus ?? focusStayedInMenu });
    }

    function handleKeydown(event) {
      if (!state) return;
      const key = String(event?.key || '');
      if (key === 'Escape') {
        event.preventDefault?.();
        event.stopPropagation?.();
        close('escape');
        return;
      }
      if (!state.menu.contains?.(event?.target)) return;
      const items = getMenuItems();
      if (!items.length) return;
      const currentIndex = Math.max(0, items.indexOf(documentRef?.activeElement));
      if (key === 'ArrowDown') {
        event.preventDefault?.();
        focusItem(currentIndex + 1);
      } else if (key === 'ArrowUp') {
        event.preventDefault?.();
        focusItem(currentIndex - 1);
      } else if (key === 'Home') {
        event.preventDefault?.();
        focusItem(0);
      } else if (key === 'End') {
        event.preventDefault?.();
        focusItem(items.length - 1);
      } else if ((key === 'Enter' || key === ' ') && items.includes(event?.target)) {
        event.preventDefault?.();
        event.target.click?.();
      }
    }

    function handleScroll(event) {
      if (!state) return;
      const scrollTarget = event?.target;
      if (scrollTarget === state.menu || state.menu.contains?.(scrollTarget)) {
        reposition();
        return;
      }
      close('scroll', { restoreFocus: false });
    }

    function handleResize() {
      if (state) reposition();
    }

    function destroy() {
      if (destroyed) return;
      close('destroy', { restoreFocus: false });
      documentRef?.removeEventListener?.('pointerdown', handlePointerDown, true);
      documentRef?.removeEventListener?.('click', handleClick, true);
      documentRef?.removeEventListener?.('keydown', handleKeydown, true);
      windowRef?.removeEventListener?.('scroll', handleScroll, true);
      windowRef?.removeEventListener?.('resize', handleResize);
      destroyed = true;
    }

    function isOpen() {
      return Boolean(state);
    }

    function getState() {
      if (!state) return null;
      return Object.freeze({
        trigger: state.trigger,
        menu: state.menu,
        context: state.context,
        position: state.position,
      });
    }

    const api = Object.freeze({
      close,
      destroy,
      getState,
      isOpen,
      open,
      reposition,
      toggle,
    });

    documentRef?.addEventListener?.('pointerdown', handlePointerDown, true);
    documentRef?.addEventListener?.('click', handleClick, true);
    documentRef?.addEventListener?.('keydown', handleKeydown, true);
    windowRef?.addEventListener?.('scroll', handleScroll, true);
    windowRef?.addEventListener?.('resize', handleResize);
    return api;
  }

  const api = Object.freeze({
    PORTAL_ATTRIBUTE,
    calculateCollisionPosition,
    createBodyPortalController,
  });

  Object.defineProperty(root, 'CarFleetActionMenu', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
