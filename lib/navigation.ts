import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export const openNativeNavigation = async (
  latitude: number,
  longitude: number,
  label?: string,
) => {
  const encodedLabel = label ? encodeURIComponent(label) : undefined;
  if (Platform.OS === 'ios') {
    const appleUrl = `http://maps.apple.com/?daddr=${latitude},${longitude}${
      encodedLabel ? `&q=${encodedLabel}` : ''
    }`;
    await Linking.openURL(appleUrl);
    return;
  }

  const googleScheme = encodedLabel
    ? `comgooglemaps://?daddr=${latitude},${longitude}&q=${encodedLabel}`
    : `comgooglemaps://?daddr=${latitude},${longitude}`;
  const googleGeo = encodedLabel
    ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`
    : `geo:${latitude},${longitude}`;

  const canUseGoogle = await Linking.canOpenURL('comgooglemaps://');
  if (canUseGoogle) {
    await Linking.openURL(googleScheme);
    return;
  }

  await Linking.openURL(googleGeo);
};
