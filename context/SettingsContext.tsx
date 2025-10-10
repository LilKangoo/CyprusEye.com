import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Accuracy } from 'expo-location';
import { startGeofencing, stopGeofencing } from '../lib/geofencing';

const STORAGE_PREFIX = 'cyprusexplorer.settings';
const STORAGE_KEYS = {
  backgroundTracking: `${STORAGE_PREFIX}.backgroundTracking`,
  accuracy: `${STORAGE_PREFIX}.accuracy`,
  distance: `${STORAGE_PREFIX}.distance`,
  time: `${STORAGE_PREFIX}.time`,
  styleIndex: `${STORAGE_PREFIX}.styleIndex`,
};
const SECURE_MAP_KEY = `${STORAGE_PREFIX}.maptilerKey`;

export type AccuracyPreset = 'balanced' | 'high';

export type MapStyle = {
  id: string;
  label: string;
  url: string;
  type: 'streets' | 'satellite';
};

type SettingsContextValue = {
  backgroundTracking: boolean;
  setBackgroundTracking: (value: boolean) => Promise<void>;
  accuracyPreset: AccuracyPreset;
  setAccuracyPreset: (value: AccuracyPreset) => Promise<void>;
  distanceInterval: number;
  setDistanceInterval: (value: number) => Promise<void>;
  timeInterval: number;
  setTimeInterval: (value: number) => Promise<void>;
  mapStyles: MapStyle[];
  activeMapStyle: MapStyle;
  toggleMapStyle: () => void;
  selectMapStyle: (index: number) => void;
  maptilerKey: string | null;
  updateMaptilerKey: (value: string | null) => Promise<void>;
  accuracy: Accuracy;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

type Extra = {
  mapStyleUrl: string | null;
  maptilerKey: string | null;
};

const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';

const accuracyPresetToEnum = (preset: AccuracyPreset): Accuracy => {
  switch (preset) {
    case 'high':
      return Accuracy.Highest;
    case 'balanced':
    default:
      return Accuracy.Balanced;
  }
};

const buildStyles = (customUrl: string | null, key: string | null): MapStyle[] => {
  const styles: MapStyle[] = [];

  if (customUrl) {
    styles.push({ id: 'custom-style', label: 'Niestandardowy', url: customUrl, type: 'streets' });
  }

  if (key) {
    styles.push({
      id: 'maptiler-streets',
      label: 'MapTiler Streets',
      url: `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`,
      type: 'streets',
    });
    styles.push({
      id: 'maptiler-hybrid',
      label: 'MapTiler Satellite',
      url: `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`,
      type: 'satellite',
    });
  }

  if (!styles.length) {
    styles.push({ id: 'demo-style', label: 'Demo (OSM)', url: FALLBACK_STYLE, type: 'streets' });
  }

  return styles;
};

export const SettingsProvider = ({ children }: PropsWithChildren) => {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const [backgroundTracking, setBackgroundTrackingState] = useState<boolean>(false);
  const [accuracyPreset, setAccuracyPresetState] = useState<AccuracyPreset>('balanced');
  const [distanceInterval, setDistanceIntervalState] = useState<number>(15);
  const [timeInterval, setTimeIntervalState] = useState<number>(6000);
  const [styleIndex, setStyleIndex] = useState<number>(0);
  const [maptilerKey, setMaptilerKey] = useState<string | null>(extra.maptilerKey ?? null);

  useEffect(() => {
    (async () => {
      const [storedBackground, storedAccuracy, storedDistance, storedTime, storedIndex] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.backgroundTracking),
          AsyncStorage.getItem(STORAGE_KEYS.accuracy),
          AsyncStorage.getItem(STORAGE_KEYS.distance),
          AsyncStorage.getItem(STORAGE_KEYS.time),
          AsyncStorage.getItem(STORAGE_KEYS.styleIndex),
        ]);

      if (storedBackground !== null) {
        setBackgroundTrackingState(storedBackground === 'true');
      }
      if (storedAccuracy === 'high' || storedAccuracy === 'balanced') {
        setAccuracyPresetState(storedAccuracy);
      }
      if (storedDistance) {
        const parsed = Number(storedDistance);
        if (!Number.isNaN(parsed)) {
          setDistanceIntervalState(Math.min(Math.max(parsed, 10), 25));
        }
      }
      if (storedTime) {
        const parsed = Number(storedTime);
        if (!Number.isNaN(parsed)) {
          setTimeIntervalState(Math.min(Math.max(parsed, 5000), 10000));
        }
      }
      if (storedIndex) {
        const parsed = Number(storedIndex);
        if (!Number.isNaN(parsed)) {
          setStyleIndex(parsed);
        }
      }

      const storedKey = await SecureStore.getItemAsync(SECURE_MAP_KEY);
      if (storedKey) {
        setMaptilerKey(storedKey);
      }
    })();
  }, []);

  const mapStyles = useMemo(
    () => buildStyles(extra.mapStyleUrl, maptilerKey),
    [extra.mapStyleUrl, maptilerKey],
  );

  useEffect(() => {
    if (styleIndex >= mapStyles.length) {
      setStyleIndex(0);
    }
  }, [mapStyles.length, styleIndex]);

  const persist = useCallback(async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  }, []);

  const setBackgroundTracking = useCallback(
    async (value: boolean) => {
      setBackgroundTrackingState(value);
      await persist(STORAGE_KEYS.backgroundTracking, value.toString());
    },
    [persist],
  );

  const setAccuracyPreset = useCallback(
    async (value: AccuracyPreset) => {
      setAccuracyPresetState(value);
      await persist(STORAGE_KEYS.accuracy, value);
    },
    [persist],
  );

  const setDistanceInterval = useCallback(
    async (value: number) => {
      const sanitized = Math.min(Math.max(value, 10), 25);
      setDistanceIntervalState(sanitized);
      await persist(STORAGE_KEYS.distance, sanitized.toString());
    },
    [persist],
  );

  const setTimeInterval = useCallback(
    async (value: number) => {
      const sanitized = Math.min(Math.max(value, 5000), 10000);
      setTimeIntervalState(sanitized);
      await persist(STORAGE_KEYS.time, sanitized.toString());
    },
    [persist],
  );

  const selectMapStyle = useCallback(
    (index: number) => {
      if (!mapStyles.length) {
        return;
      }
      const nextIndex = ((index % mapStyles.length) + mapStyles.length) % mapStyles.length;
      setStyleIndex(nextIndex);
      AsyncStorage.setItem(STORAGE_KEYS.styleIndex, nextIndex.toString()).catch(() => undefined);
    },
    [mapStyles.length],
  );

  const toggleMapStyle = useCallback(() => {
    if (mapStyles.length <= 1) {
      return;
    }
    const nextIndex = (styleIndex + 1) % mapStyles.length;
    selectMapStyle(nextIndex);
  }, [mapStyles.length, selectMapStyle, styleIndex]);

  const updateMaptilerKey = useCallback(async (value: string | null) => {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      setMaptilerKey(null);
      await SecureStore.deleteItemAsync(SECURE_MAP_KEY);
      return;
    }
    setMaptilerKey(trimmed);
    await SecureStore.setItemAsync(SECURE_MAP_KEY, trimmed);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      backgroundTracking,
      setBackgroundTracking,
      accuracyPreset,
      setAccuracyPreset,
      distanceInterval,
      setDistanceInterval,
      timeInterval,
      setTimeInterval,
      mapStyles,
      activeMapStyle: mapStyles[Math.min(styleIndex, Math.max(mapStyles.length - 1, 0))],
      toggleMapStyle,
      selectMapStyle,
      maptilerKey,
      updateMaptilerKey,
      accuracy: accuracyPresetToEnum(accuracyPreset),
    }),
    [
      accuracyPreset,
      backgroundTracking,
      mapStyles,
      maptilerKey,
      selectMapStyle,
      setAccuracyPreset,
      setBackgroundTracking,
      setDistanceInterval,
      setTimeInterval,
      distanceInterval,
      timeInterval,
      toggleMapStyle,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (backgroundTracking) {
          await startGeofencing();
        } else {
          await stopGeofencing();
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Nie udało się przełączyć geofencingu', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backgroundTracking]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings musi być użyte wewnątrz SettingsProvider');
  }
  return context;
};
