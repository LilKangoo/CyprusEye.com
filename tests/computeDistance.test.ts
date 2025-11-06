import { computeDistance } from '../lib/geo';

describe('computeDistance', () => {
  it('returns distance in meters between two coordinates', () => {
    const distance = computeDistance(
      { latitude: 34.9953, longitude: 32.7416 },
      { latitude: 34.9876, longitude: 33.9813 },
    );
    expect(distance).toBeGreaterThan(110000);
    expect(distance).toBeLessThan(120000);
  });

  it('returns zero for identical coordinates', () => {
    const distance = computeDistance({ latitude: 35.0, longitude: 33.0 }, { latitude: 35.0, longitude: 33.0 });
    expect(distance).toBe(0);
  });
});
