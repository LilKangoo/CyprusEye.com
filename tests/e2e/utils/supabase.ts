import { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supabaseStubPath = path.resolve(__dirname, '../../fixtures/supabase-stub.js');
const supabaseStubSource = readFileSync(supabaseStubPath, 'utf8');

export const SUPABASE_MODULE_URL = 'https://esm.sh/@supabase/supabase-js@2';

export async function enableSupabaseStub(page: Page) {
  await page.route(`${SUPABASE_MODULE_URL}*`, async (route) => {
    await route.fulfill({
      status: 200,
      body: supabaseStubSource,
      headers: { 'content-type': 'application/javascript' },
    });
  });
}

export async function waitForSupabaseStub(page: Page) {
  await page.waitForFunction(() => typeof (window as any).__supabaseStub !== 'undefined');
}

export async function resetSupabaseStub(page: Page) {
  await page.evaluate(() => {
    const stub = (window as any).__supabaseStub;
    if (stub && typeof stub.reset === 'function') {
      stub.reset();
    }
  });
}
