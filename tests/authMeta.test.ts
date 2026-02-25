import fs from 'node:fs';
import path from 'node:path';

describe('auth meta configuration', () => {
  const htmlPath = path.join(process.cwd(), 'auth', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  it('includes auth marker meta tag', () => {
    expect(html.includes('meta name="ce-auth"')).toBe(true);
  });

  it('loads Supabase client script before auth scripts', () => {
    const supabaseMatch = html.match(/<script\s+type="module"\s+src="\/js\/supabaseClient\.js(?:\?[^"]*)?"/i);
    const authMatch = html.match(/<script\s+type="module"\s+src="\/js\/auth\.js(?:\?[^"]*)?"/i);
    const supabaseClientIndex = supabaseMatch ? html.indexOf(supabaseMatch[0]) : -1;
    const authScriptIndex = authMatch ? html.indexOf(authMatch[0]) : -1;
    expect(supabaseClientIndex).toBeGreaterThan(-1);
    expect(authScriptIndex).toBeGreaterThan(-1);
    expect(supabaseClientIndex).toBeLessThan(authScriptIndex);
  });
});
