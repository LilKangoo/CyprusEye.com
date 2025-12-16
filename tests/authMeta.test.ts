import fs from 'node:fs';
import path from 'node:path';

describe('auth meta configuration', () => {
  const htmlPath = path.join(process.cwd(), 'auth', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  it('includes auth marker meta tag', () => {
    expect(html.includes('meta name="ce-auth"')).toBe(true);
  });

  it('loads Supabase client script before auth scripts', () => {
    const supabaseClientIndex = html.indexOf('<script type="module" src="/js/supabaseClient.js"');
    const authScriptIndex = html.indexOf('<script type="module" src="/js/auth.js"');
    expect(supabaseClientIndex).toBeGreaterThan(-1);
    expect(authScriptIndex).toBeGreaterThan(-1);
    expect(supabaseClientIndex).toBeLessThan(authScriptIndex);
  });
});
