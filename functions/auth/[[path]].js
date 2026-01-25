import { serveStatic } from '../_utils/serveStatic.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname || '';

  if (pathname.startsWith('/auth/callback')) {
    return serveStatic(context, '/auth/callback/index.html');
  }

  // zawsze serwuj /auth/index.html dla wszystkiego pod /auth/*
  return serveStatic(context, '/auth/index.html');
}
