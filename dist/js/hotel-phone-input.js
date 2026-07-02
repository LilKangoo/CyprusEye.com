import { enhancePhoneInput } from './phone-input.js';

const HOTEL_PHONE_LABELS = {
  pl: {
    chooseCountryCode: 'Wybierz kierunkowy',
    searchCountryOrCode: 'Szukaj kraju lub kodu',
    phoneNumber: 'Numer telefonu',
    noResults: 'Brak wyników',
  },
  en: {
    chooseCountryCode: 'Choose country code',
    searchCountryOrCode: 'Search country or code',
    phoneNumber: 'Phone number',
    noResults: 'No results',
  },
  he: {
    chooseCountryCode: 'בחרו קידומת מדינה',
    searchCountryOrCode: 'חפשו מדינה או קוד',
    phoneNumber: 'מספר טלפון',
    noResults: 'אין תוצאות',
  },
};

function normalizeHotelPhoneLanguage(value) {
  const normalized = String(value || document.documentElement?.lang || 'en')
    .trim()
    .toLowerCase();
  if (normalized.startsWith('pl')) return 'pl';
  if (normalized.startsWith('he')) return 'he';
  return 'en';
}

function resolveHotelPhoneInput(target) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (node instanceof HTMLInputElement) return node;
  if (node instanceof HTMLFormElement || node instanceof HTMLElement) {
    const input = node.querySelector('input[name="phone"], #hotelBookingPhone');
    return input instanceof HTMLInputElement ? input : null;
  }
  return null;
}

function getHotelPhoneLanguage(options = {}) {
  if (typeof options.language === 'function') {
    return normalizeHotelPhoneLanguage(options.language());
  }
  return normalizeHotelPhoneLanguage(
    options.language
    || window.getCurrentLanguage?.()
    || window.appI18n?.language
    || document.documentElement?.lang
    || 'en',
  );
}

export function enhanceHotelPhoneInput(target, options = {}) {
  const input = resolveHotelPhoneInput(target);
  if (!(input instanceof HTMLInputElement)) return null;

  const wasRequired = Boolean(options.required || input.required || input.hasAttribute('required'));
  input.dataset.hotelPhoneRequired = wasRequired ? '1' : '0';
  const controller = enhancePhoneInput(input, {
    language: () => getHotelPhoneLanguage(options),
    required: wasRequired,
    fieldClass: options.fieldClass || 'hotel-phone-field',
    placeholder: options.placeholder || '123456789',
    labels: HOTEL_PHONE_LABELS,
  });
  controller?.setLanguage?.(getHotelPhoneLanguage(options));
  return controller;
}

export function syncHotelPhoneInput(target) {
  const input = resolveHotelPhoneInput(target);
  const controller = input?.__cePhoneInputController || null;
  return controller?.sync?.() || String(input?.value || '').trim();
}

export function setHotelPhoneFullNumber(target, value) {
  const input = resolveHotelPhoneInput(target);
  const controller = input?.__cePhoneInputController || null;
  if (controller?.setFullNumber) {
    controller.setFullNumber(value);
    return true;
  }
  if (input instanceof HTMLInputElement) {
    input.value = String(value || '').trim();
    return true;
  }
  return false;
}

export function setHotelPhoneInputLanguage(target, language) {
  const input = resolveHotelPhoneInput(target);
  const controller = input?.__cePhoneInputController || null;
  controller?.setLanguage?.(normalizeHotelPhoneLanguage(language));
}

export function validateHotelPhoneInput(target, messages = {}) {
  const input = resolveHotelPhoneInput(target);
  if (!(input instanceof HTMLInputElement)) return null;
  const required = input.dataset.hotelPhoneRequired === '1' || input.required || input.hasAttribute('required');
  const controller = input.__cePhoneInputController || null;
  if (!required) {
    controller?.sync?.();
    return null;
  }

  const state = controller?.validate?.() || {
    countryCode: '',
    localNumber: String(input.value || '').trim(),
    fullNumber: String(input.value || '').trim(),
  };
  controller?.sync?.();
  if (!state.countryCode && controller) {
    return messages.countryCodeRequired || 'Country code is required.';
  }
  if (!state.localNumber || !String(input.value || '').trim()) {
    return messages.phoneRequired || 'Phone number is required.';
  }
  return null;
}

export const hotelPhoneInputLabels = HOTEL_PHONE_LABELS;
