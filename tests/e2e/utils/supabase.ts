import { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supabaseStubPath = path.resolve(__dirname, '../../fixtures/supabase-stub.js');
const supabaseStubSource = readFileSync(supabaseStubPath, 'utf8');

export const SUPABASE_MODULE_URL = 'https://esm.sh/@supabase/supabase-js@2';
export const SUPABASE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

export async function enableSupabaseStub(page: Page) {
  // Inject stub source directly as an init script
  // This runs BEFORE any page scripts, including module imports
  await page.addInitScript(supabaseStubSource);
  
  // Also intercept network requests as backup
  await page.route('**/*@supabase/supabase-js*', async (route) => {
    await route.fulfill({
      status: 200,
      body: supabaseStubSource,
      headers: { 'content-type': 'application/javascript' },
    });
  });
}

export async function waitForSupabaseStub(page: Page) {
  // Try to wait for stub, but don't fail if it doesn't load
  // Some tests may not need the stub
  try {
    await page.waitForFunction(
      () => typeof (window as any).__supabaseStub !== 'undefined',
      { timeout: 2000 }
    );
  } catch (error) {
    console.warn('Supabase stub did not load within 2s, continuing anyway...');
  }
}

export async function resetSupabaseStub(page: Page) {
  await page.evaluate(() => {
    const stub = (window as any).__supabaseStub;
    if (stub && typeof stub.clearPersistence === 'function') {
      stub.clearPersistence();
    }
    if (stub && typeof stub.reset === 'function') {
      stub.reset();
    }
  });
}
