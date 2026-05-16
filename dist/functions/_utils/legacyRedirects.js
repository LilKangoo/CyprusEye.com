export const LEGACY_CAR_REDIRECT_TARGET = '/car.html';

export const LEGACY_CAR_REDIRECT_PATHS = Object.freeze([
  '/car-rental-landing',
  '/car-rental-landing/',
  '/car-rental-landing.html',
  '/car-rental',
  '/car-rental/',
  '/car-rental.html',
  '/autopfo',
  '/autopfo/',
  '/autopfo.html',
]);

const LEGACY_CAR_REDIRECT_PATH_SET = new Set(LEGACY_CAR_REDIRECT_PATHS);

export function isLegacyCarRedirectPath(pathname) {
  return LEGACY_CAR_REDIRECT_PATH_SET.has(String(pathname || ''));
}

export function buildLegacyCarRedirectLocation(url) {
  const search = url instanceof URL ? url.search : '';
  return `${LEGACY_CAR_REDIRECT_TARGET}${search || ''}`;
}
