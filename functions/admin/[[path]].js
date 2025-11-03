/**
 * Cloudflare Pages Function
 * Serves static files from /admin directory
 */

import { serveStatic } from '../_utils/serveStatic.js';

export async function onRequest(context) {
  return serveStatic(context, 'admin');
}
