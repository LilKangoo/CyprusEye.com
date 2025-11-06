import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { LocationObject, LocationPermissionResponse } from 'expo-location';
import { computeDistance } from '../lib/geo';

const TELEPORT_DISTANCE_METERS = 150;
const TELEPORT_TIME_SECONDS = 1;

export type UseLiveLocationOptions = {
  distanceInterval?: number;
  timeInterval?: number;
  accuracy?: Location.Accuracy;
};

export type LiveLocation = {
  location: LocationObject | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  permissionStatus: Location.PermissionStatus;
  error: string | null;
  requestForegroundPermissions: () => Promise<LocationPermissionResponse>;
  requestBackgroundPermissions: () => Promise<LocationPermissionResponse>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
};

export const useLiveLocation = (options: UseLiveLocationOptions = {}): LiveLocation => {
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus>(
    Location.PermissionStatus.UNDETERMINED,
  );
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<LocationObject | null>(null);

  const distanceInterval = options.distanceInterval ?? 15;
  const timeInterval = options.timeInterval ?? 6000;
  const accuracy = options.accuracy ?? Location.Accuracy.Balanced;

  const stopWatching = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const startWatching = useCallback(async () => {
    const status = permissionStatus;
    if (status !== Location.PermissionStatus.GRANTED) {
      return;
    }
    stopWatching();

    try {
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy,
          distanceInterval,
          timeInterval,
          mayShowUserSettingsDialog: true,
        },
        (loc) => {
          const last = lastLocationRef.current;
          if (last) {
            const distance = computeDistance(
              { latitude: last.coords.latitude, longitude: last.coords.longitude },
              { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            );
            const deltaSeconds = Math.max((loc.timestamp - last.timestamp) / 1000, 0);
            if (
              deltaSeconds > 0 &&
              deltaSeconds <= TELEPORT_TIME_SECONDS &&
              distance > TELEPORT_DISTANCE_METERS &&
              distance / deltaSeconds > TELEPORT_DISTANCE_METERS
            ) {
              // Ignorujemy "teleport" aby oszczędzić baterię i stabilność geofencingu.
              return;
            }
          }

          lastLocationRef.current = loc;
          setLocation(loc);
          setError(null);
        },
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }, [accuracy, distanceInterval, permissionStatus, stopWatching, timeInterval]);

  useEffect(() => {
    (async () => {
      const foreground = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(foreground.status);
      if (foreground.status === Location.PermissionStatus.GRANTED) {
        await startWatching();
      }
    })();

    return () => {
      stopWatching();
    };
  }, [startWatching, stopWatching]);

  useEffect(() => {
    if (permissionStatus === Location.PermissionStatus.GRANTED) {
      startWatching().catch((err) => setError((err as Error).message));
    }
  }, [accuracy, distanceInterval, permissionStatus, startWatching, timeInterval]);

  const requestForegroundPermissions = useCallback(async () => {
    const response = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(response.status);
    if (response.status === Location.PermissionStatus.GRANTED) {
      await startWatching();
    } else {
      stopWatching();
    }
    return response;
  }, [startWatching, stopWatching]);

  const requestBackgroundPermissions = useCallback(async () => {
    const response = await Location.requestBackgroundPermissionsAsync();
    return response;
  }, []);

  const coords = location?.coords ?? null;

  return useMemo(
    () => ({
      location,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      heading: coords?.heading ?? null,
      speed: coords?.speed ?? null,
      accuracy: coords?.accuracy ?? null,
      permissionStatus,
      error,
      requestForegroundPermissions,
      requestBackgroundPermissions,
      startWatching,
      stopWatching,
    }),
    [
      accuracy,
      coords?.accuracy,
      coords?.heading,
      coords?.latitude,
      coords?.longitude,
      coords?.speed,
      error,
      location,
      permissionStatus,
      requestBackgroundPermissions,
      requestForegroundPermissions,
      startWatching,
      stopWatching,
    ],
  );
};

export default useLiveLocation;
