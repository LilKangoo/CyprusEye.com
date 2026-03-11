import fs from 'node:fs';
import path from 'node:path';

describe('_routes.json', () => {
  const routesPath = path.join(process.cwd(), '_routes.json');
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  const include = Array.isArray(routes?.include) ? routes.include : [];

  it('routes hotel booking requests through Cloudflare Pages Functions', () => {
    expect(include).toContain('/hotel/*');
  });

  it('routes transport booking requests through Cloudflare Pages Functions', () => {
    expect(include).toContain('/transport/*');
  });

  it('routes api requests through Cloudflare Pages Functions', () => {
    expect(include).toContain('/api/*');
  });
});
