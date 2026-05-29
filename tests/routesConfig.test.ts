import fs from 'node:fs';
import path from 'node:path';

describe('_routes.json', () => {
  const routesPath = path.join(process.cwd(), '_routes.json');
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  const include = Array.isArray(routes?.include) ? routes.include : [];
  const routesThroughFunctions = (route: string) => include.includes(route) || include.includes('/*');

  it('routes hotel booking requests through Cloudflare Pages Functions', () => {
    expect(routesThroughFunctions('/hotel/*')).toBe(true);
  });

  it('routes transport booking requests through Cloudflare Pages Functions', () => {
    expect(routesThroughFunctions('/transport/*')).toBe(true);
  });

  it('routes api requests through Cloudflare Pages Functions', () => {
    expect(routesThroughFunctions('/api/*')).toBe(true);
  });
});
