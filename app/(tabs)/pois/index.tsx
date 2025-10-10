import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../../context/SettingsContext';
import useLiveLocation from '../../../hooks/useLiveLocation';
import { computeDistance } from '../../../lib/geo';
import { POIS } from '../../../lib/geofencing';
import { openNativeNavigation } from '../../../lib/navigation';

export default function PoiListScreen() {
  const { distanceInterval, timeInterval, accuracy } = useSettings();
  const { latitude, longitude, permissionStatus, requestForegroundPermissions } = useLiveLocation({
    distanceInterval,
    timeInterval,
    accuracy,
  });
  const insets = useSafeAreaInsets();

  const data = useMemo(() => {
    return POIS.map((poi) => {
      if (latitude === null || longitude === null) {
        return { ...poi, distance: null };
      }
      const distance = computeDistance(
        { latitude, longitude },
        { latitude: poi.lat, longitude: poi.lon },
      );
      return { ...poi, distance };
    }).sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
  }, [latitude, longitude]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {permissionStatus !== Location.PermissionStatus.GRANTED && (
          <View style={styles.permissionBanner}>
            <Text style={styles.permissionText}>
              Dostęp do lokalizacji pozwala policzyć dystans do punktów.
            </Text>
            <TouchableOpacity
              onPress={() => requestForegroundPermissions().catch(() => undefined)}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonLabel}>Nadaj dostęp</Text>
            </TouchableOpacity>
          </View>
        )}
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.radiusBadge}>{Math.round(item.radius)} m</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                {item.distance !== null ? formatDistance(item.distance) : 'Lokalizacja nieznana'}
              </Text>
              <TouchableOpacity
                onPress={() => openNativeNavigation(item.lat, item.lon, item.name)}
                style={styles.navigateButton}
              >
                <Text style={styles.navigateButtonLabel}>Nawiguj</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const formatDistance = (distance: number) => {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(2)} km od Ciebie`;
  }
  return `${Math.round(distance)} m od Ciebie`;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContent: {
    paddingTop: 4,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  radiusBadge: {
    backgroundColor: '#ecfeff',
    color: '#0e7490',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  navigateButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navigateButtonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  permissionBanner: {
    marginBottom: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fcd34d',
    gap: 10,
  },
  permissionText: {
    color: '#78350f',
    lineHeight: 19,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f97316',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  permissionButtonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
