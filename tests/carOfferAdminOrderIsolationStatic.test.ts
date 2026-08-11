import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_ORDER_FIELDS = Object.freeze([
  'admin_sort_order',
  'car_offer_admin_order',
]);

function listJavaScriptFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
    }
  };
  visit(root);
  return files.sort();
}

describe('Cars Admin order isolation from public runtime', () => {
  test('public source and generated JS never read Admin-only ordering contracts', () => {
    const roots = [path.join(process.cwd(), 'js'), path.join(process.cwd(), 'dist', 'js')];
    const offenders: string[] = [];

    for (const file of roots.flatMap(listJavaScriptFiles)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const field of PUBLIC_ORDER_FIELDS) {
        if (source.includes(field)) {
          offenders.push(`${path.relative(process.cwd(), file)} reads ${field}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test('homepage and /car retain final quote ordering without an Admin-order seam', () => {
    const homepage = fs.readFileSync(path.join(process.cwd(), 'js', 'home-cars.js'), 'utf8');
    const carPage = fs.readFileSync(path.join(process.cwd(), 'js', 'car-rental-paphos.js'), 'utf8');

    expect(homepage).toContain('resolveCarRentalAvailability');
    expect(homepage).toContain('a.quote?.total');
    expect(homepage).toContain('a.car?.sort_order');
    expect(carPage).toContain('resolveCarRentalAvailability');
    expect(carPage).toContain('a.comparablePrice - b.comparablePrice');
    expect(carPage).toContain('return a.index - b.index;');

    for (const field of PUBLIC_ORDER_FIELDS) {
      expect(homepage).not.toContain(field);
      expect(carPage).not.toContain(field);
    }
  });
});
