/**
 * DOM Manipulation Utilities
 * Pure functions for common DOM operations
 */

/**
 * Safely query selector with null check
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {Element|null}
 */
export function querySelector(selector, context = document) {
  try {
    return context.querySelector(selector);
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * Safely query all with null check
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {Element[]}
 */
export function querySelectorAll(selector, context = document) {
  try {
    return Array.from(context.querySelectorAll(selector));
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return [];
  }
}

/**
 * Add class to element
 * @param {Element} element - DOM element
 * @param {string|string[]} classNames - Class name(s) to add
 */
export function addClass(element, classNames) {
  if (!element) return;
  const classes = Array.isArray(classNames) ? classNames : [classNames];
  element.classList.add(...classes);
}

/**
 * Remove class from element
 * @param {Element} element - DOM element
 * @param {string|string[]} classNames - Class name(s) to remove
 */
export function removeClass(element, classNames) {
  if (!element) return;
  const classes = Array.isArray(classNames) ? classNames : [classNames];
  element.classList.remove(...classes);
}

/**
 * Toggle class on element
 * @param {Element} element - DOM element
 * @param {string} className - Class name to toggle
 * @param {boolean} force - Force add/remove
 * @returns {boolean} Whether class is present after toggle
 */
export function toggleClass(element, className, force) {
  if (!element) return false;
  return element.classList.toggle(className, force);
}

/**
 * Check if element has class
 * @param {Element} element - DOM element
 * @param {string} className - Class name to check
 * @returns {boolean}
 */
export function hasClass(element, className) {
  if (!element) return false;
  return element.classList.contains(className);
}

/**
 * Set element attribute
 * @param {Element} element - DOM element
 * @param {string} name - Attribute name
 * @param {string} value - Attribute value
 */
export function setAttribute(element, name, value) {
  if (!element) return;
  element.setAttribute(name, value);
}

/**
 * Remove element attribute
 * @param {Element} element - DOM element
 * @param {string} name - Attribute name
 */
export function removeAttribute(element, name) {
  if (!element) return;
  element.removeAttribute(name);
}

/**
 * Show element (remove hidden attribute)
 * @param {Element} element - DOM element
 */
export function showElement(element) {
  if (!element) return;
  element.hidden = false;
  element.removeAttribute('aria-hidden');
}

/**
 * Hide element (add hidden attribute)
 * @param {Element} element - DOM element
 */
export function hideElement(element) {
  if (!element) return;
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');
}

/**
 * Toggle element visibility
 * @param {Element} element - DOM element
 * @param {boolean} show - Force show/hide
 */
export function toggleElement(element, show) {
  if (!element) return;
  
  if (show === undefined) {
    show = element.hidden;
  }
  
  if (show) {
    showElement(element);
  } else {
    hideElement(element);
  }
}

/**
 * Create element with attributes
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Attributes to set
 * @param {string} content - Text content
 * @returns {Element}
 */
export function createElement(tag, attributes = {}, content = '') {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });
  
  if (content) {
    element.textContent = content;
  }
  
  return element;
}

/**
 * Remove all children from element
 * @param {Element} element - DOM element
 */
export function clearChildren(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Get element's offset position
 * @param {Element} element - DOM element
 * @returns {Object} {top, left}
 */
export function getOffset(element) {
  if (!element) return { top: 0, left: 0 };
  
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX
  };
}

/**
 * Scroll to element smoothly
 * @param {Element} element - DOM element
 * @param {Object} options - Scroll options
 */
export function scrollToElement(element, options = {}) {
  if (!element) return;
  
  element.scrollIntoView({
    behavior: options.smooth !== false ? 'smooth' : 'auto',
    block: options.block || 'start',
    inline: options.inline || 'nearest'
  });
}
