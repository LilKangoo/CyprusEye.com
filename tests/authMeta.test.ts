import fs from 'node:fs';
import path from 'node:path';

describe('auth meta configuration', () => {
  const htmlPath = path.join(__dirname, '..', 'auth', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  it('includes Supabase meta tags', () => {
    expect(html.includes('meta name="supabase-url"')).toBe(true);
    expect(html.includes('meta name="supabase-anon"')).toBe(true);
    expect(html.includes('meta name="supabase-publishable"')).toBe(true);
  });

  it('declares Supabase meta tags before client script', () => {
    const metaIndex = html.indexOf('<meta name="supabase-url"');
    const scriptIndex = html.indexOf('<script type="module" src="/js/supabaseClient.js"');
    expect(metaIndex).toBeGreaterThan(-1);
    expect(scriptIndex).toBeGreaterThan(-1);
    expect(metaIndex).toBeLessThan(scriptIndex);
  });
});
