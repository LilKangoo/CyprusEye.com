import { serveStatic } from '../_utils/serveStatic.js';

export async function onRequest(context) {
  // zawsze serwuj /auth/index.html dla wszystkiego pod /auth/*
  return serveStatic(context, '/auth/index.html');
}
