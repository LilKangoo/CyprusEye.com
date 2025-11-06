import { distance as turfDistance, point as turfPoint } from '@turf/turf';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const computeDistance = (a: Coordinates, b: Coordinates): number => {
  const from = turfPoint([a.longitude, a.latitude]);
  const to = turfPoint([b.longitude, b.latitude]);
  const kilometers = turfDistance(from, to, { units: 'kilometers' });
  return kilometers * 1000;
};
