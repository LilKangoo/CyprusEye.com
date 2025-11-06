import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export const ensureForegroundPermissions = async () => {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === Location.PermissionStatus.GRANTED) {
    return existing;
  }
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested;
};

export const ensureBackgroundPermissions = async () => {
  const existing = await Location.getBackgroundPermissionsAsync();
  if (existing.status === Location.PermissionStatus.GRANTED) {
    return existing;
  }
  const requested = await Location.requestBackgroundPermissionsAsync();
  return requested;
};

export const openSystemLocationSettings = async () => {
  if (Platform.OS === 'android') {
    await Linking.openSettings();
  } else {
    await Linking.openURL('app-settings:');
  }
};
