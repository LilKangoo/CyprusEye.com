import { serveStatic } from '../_utils/serveStatic.js';

export async function onRequest(context) {
  return serveStatic(context, '/account/index.html');
}
