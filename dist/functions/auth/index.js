import { serveStatic } from '../_utils/serveStatic.js';

export async function onRequest(context) {
  return serveStatic(context, '/auth/index.html');
}
