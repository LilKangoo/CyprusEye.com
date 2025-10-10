import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';

const APP_NAME = 'CyprusExplorer';
const SLUG = 'cyprus-explorer';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: SLUG,
  version: '1.0.0',
  scheme: 'cyprusexplorer',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android'],
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.example.cyprusexplorer',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Aplikacja potrzebuje dostępu do lokalizacji, aby pokazać Twoją pozycję na mapie.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Dostęp do lokalizacji w tle pozwala na monitorowanie geostref i wysyłanie powiadomień.',
    },
    backgroundModes: ['location'],
  },
  android: {
    package: 'com.example.cyprusexplorer',
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ],
    foregroundService: {
      notificationTitle: 'Geofencing aktywne',
      notificationBody: 'Aplikacja monitoruje wejścia i wyjścia ze stref.',
    },
  },
  plugins: [
    'expo-router',
    'expo-notifications',
    '@maplibre/maplibre-react-native',
  ],
  extra: {
    mapStyleUrl: process.env.MAP_STYLE_URL ?? null,
    maptilerKey: process.env.MAPTILER_KEY ?? null,
  },
  experiments: {
    typedRoutes: true,
  },
});
