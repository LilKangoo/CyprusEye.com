import fs from 'node:fs';
import path from 'node:path';

describe('admin user management details modal', () => {
  const repoRoot = process.cwd();
  const adminSource = fs.readFileSync(path.join(repoRoot, 'admin/admin.js'), 'utf8');

  it('keeps transport location labels available to the user details booking renderer', () => {
    expect(adminSource).toContain('let transportLocationLabelById = {};');
    expect(adminSource).toContain('transportLocationLabelById[id] = primary || local || code ||');
    expect(adminSource).toContain('locationLabelById: transportLocationLabelById');
    expect(adminSource).not.toContain('const locationLabelById = {};');
  });

  it('keeps empty booking states in the user details modal', () => {
    expect(adminSource).toContain('const renderServiceBookingsTable = (rows, kind) =>');
    expect(adminSource).toContain('<p class="user-detail-hint">No bookings found.</p>');
    expect(adminSource).toContain('<p class="user-detail-hint">No shop orders found.</p>');
  });
});
