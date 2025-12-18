import { test as base } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supabaseStubPath = path.resolve(__dirname, '../fixtures/supabase-stub.js');
const supabaseStubSource = readFileSync(supabaseStubPath, 'utf8');

export const test = base.extend({
  context: async ({ context }, use) => {
    // Intercept ALL esm.sh requests to catch Supabase module
    await context.route('https://esm.sh/**', async (route) => {
      const url = route.request().url();
      if (url.includes('supabase')) {
        await route.fulfill({
          status: 200,
          body: supabaseStubSource,
          headers: {
            'content-type': 'application/javascript; charset=utf-8',
            'access-control-allow-origin': '*',
          },
        });
      } else {
        await route.continue();
      }
    });
    await use(context);
  },
  page: async ({ page }, use) => {
    // Set up localStorage flags to disable tutorial/language modal
    await page.addInitScript(() => {
      window.localStorage.setItem('seenTutorial', 'true');
      window.localStorage.setItem('ce_lang_selected', 'true');
      if (!window.localStorage.getItem('ce_lang')) {
        window.localStorage.setItem('ce_lang', 'pl');
      }
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
