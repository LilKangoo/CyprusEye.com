/**
 * Cloudflare Pages Function
 * Serves /admin/index.html
 */

import { serveStatic } from '../_utils/serveStatic.js';

export async function onRequest(context) {
  return serveStatic(context, 'admin');
}
