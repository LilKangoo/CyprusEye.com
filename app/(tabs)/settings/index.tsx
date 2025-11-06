import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../../context/SettingsContext';
import { ensureBackgroundPermissions, ensureForegroundPermissions, openSystemLocationSettings } from '../../../lib/permissions';

const formatInterval = (value: number) => `${Math.round(value)} m`;

export default function SettingsScreen() {
  const {
    backgroundTracking,
    setBackgroundTracking,
    accuracyPreset,
    setAccuracyPreset,
    distanceInterval,
    setDistanceInterval,
    timeInterval,
    setTimeInterval,
    mapStyles,
    activeMapStyle,
    toggleMapStyle,
    maptilerKey,
    updateMaptilerKey,
  } = useSettings();

  const [mapKeyDraft, setMapKeyDraft] = useState(maptilerKey ?? '');
  const [distanceDraft, setDistanceDraft] = useState(String(distanceInterval));
  const [timeDraft, setTimeDraft] = useState(String(timeInterval));
  const [backgroundStatus, setBackgroundStatus] = useState<Location.PermissionStatus | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setMapKeyDraft(maptilerKey ?? '');
  }, [maptilerKey]);

  useEffect(() => {
    setDistanceDraft(String(distanceInterval));
  }, [distanceInterval]);

  useEffect(() => {
    setTimeDraft(String(timeInterval));
  }, [timeInterval]);

  useEffect(() => {
    Location.getBackgroundPermissionsAsync().then((res) => setBackgroundStatus(res.status));
  }, []);

  const backgroundStatusLabel = useMemo(() => {
    switch (backgroundStatus) {
      case Location.PermissionStatus.GRANTED:
        return 'Zezwolono na śledzenie w tle';
      case Location.PermissionStatus.DENIED:
        return 'Brak zgody na śledzenie w tle';
      case Location.PermissionStatus.UNDETERMINED:
      default:
        return 'Status nieznany';
    }
  }, [backgroundStatus]);

  const handleBackgroundToggle = async (value: boolean) => {
    if (value) {
      const fg = await ensureForegroundPermissions();
      if (fg.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Uprawnienia wymagane', 'Nadaj dostęp do lokalizacji, aby włączyć tryb w tle.');
        return;
      }
      const bg = await ensureBackgroundPermissions();
      setBackgroundStatus(bg.status);
      if (bg.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          'Śledzenie w tle zablokowane',
          'OS blokuje monitorowanie w tle. Otwórz ustawienia systemowe i nadaj pełne uprawnienia.',
          [
            { text: 'Później', style: 'cancel' },
            {
              text: 'Ustawienia',
              onPress: () => openSystemLocationSettings().catch(() => undefined),
            },
          ],
        );
        return;
      }
    }
    await setBackgroundTracking(value);
  };

  const handleAccuracyChange = (value: 'balanced' | 'high') => {
    setAccuracyPreset(value).catch(() => undefined);
  };

  const handleDistanceBlur = () => {
    const next = Number(distanceDraft);
    if (Number.isNaN(next)) {
      setDistanceDraft(String(distanceInterval));
      return;
    }
    setDistanceInterval(next).catch(() => undefined);
  };

  const handleTimeBlur = () => {
    const next = Number(timeDraft);
    if (Number.isNaN(next)) {
      setTimeDraft(String(timeInterval));
      return;
    }
    setTimeInterval(next).catch(() => undefined);
  };

  const handleSaveKey = async () => {
    await updateMaptilerKey(mapKeyDraft);
    Alert.alert('Zapisano', 'Nowy klucz MapTiler zapisany bezpiecznie.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Geofencing w tle</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Śledź w tle</Text>
            <Switch
              value={backgroundTracking}
              onValueChange={handleBackgroundToggle}
              trackColor={{ false: '#d1d5db', true: '#2563eb' }}
              thumbColor={backgroundTracking ? '#1e3a8a' : '#f4f4f5'}
            />
          </View>
          <Text style={styles.helper}>{backgroundStatusLabel}</Text>
          {backgroundStatus === Location.PermissionStatus.DENIED && (
            <TouchableOpacity
              style={styles.settingsLink}
              onPress={() => openSystemLocationSettings().catch(() => undefined)}
            >
              <Text style={styles.settingsLinkLabel}>Otwórz ustawienia systemu</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.batteryHint}>
            Wysoka częstotliwość aktualizacji zwiększa zużycie baterii. Utrzymujemy odświeżanie co {timeInterval / 1000} s
            i minimalny dystans {formatInterval(distanceInterval)}.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dokładność i próbkowanie</Text>
          <View style={styles.segmentedRow}>
            <TouchableOpacity
              style={[styles.segment, accuracyPreset === 'balanced' && styles.segmentActive]}
              onPress={() => handleAccuracyChange('balanced')}
            >
              <Text
                style={[styles.segmentLabel, accuracyPreset === 'balanced' && styles.segmentLabelActive]}
              >
                Balanced
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segment, accuracyPreset === 'high' && styles.segmentActive]}
              onPress={() => handleAccuracyChange('high')}
            >
              <Text style={[styles.segmentLabel, accuracyPreset === 'high' && styles.segmentLabelActive]}>High</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <Text style={[styles.label, styles.inputLabel]}>Minimalny dystans (m)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={distanceDraft}
              onChangeText={setDistanceDraft}
              onBlur={handleDistanceBlur}
              placeholder="15"
              returnKeyType="done"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={[styles.label, styles.inputLabel]}>Interwał czasu (ms)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={timeDraft}
              onChangeText={setTimeDraft}
              onBlur={handleTimeBlur}
              placeholder="6000"
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Styl mapy</Text>
          <Text style={styles.helper}>Aktywny: {activeMapStyle.label}</Text>
          {mapStyles.length > 1 && (
            <TouchableOpacity style={styles.button} onPress={toggleMapStyle}>
              <Text style={styles.buttonLabel}>Przełącz styl ({mapStyles.length} dostępnych)</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.label}>Klucz MapTiler</Text>
          <TextInput
            style={styles.input}
            placeholder="Wklej klucz MapTiler"
            value={mapKeyDraft}
            onChangeText={setMapKeyDraft}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.button} onPress={handleSaveKey}>
            <Text style={styles.buttonLabel}>Zapisz klucz</Text>
          </TouchableOpacity>
          <Text style={styles.helper}>
            Jeśli pole pozostanie puste użyjemy publicznego stylu demonstracyjnego MapLibre (OSM).
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prywatność</Text>
          <Text style={styles.helper}>
            Lokalizacja jest przetwarzana wyłącznie na urządzeniu. W tle rejestrujemy zdarzenia wejścia/wyjścia ze stref i
            pokazujemy powiadomienia lokalne – bez wysyłania danych do chmury.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 24,
  },
  label: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  inputLabel: {
    flex: 1,
    marginRight: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helper: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 19,
  },
  batteryHint: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
    marginTop: 4,
  },
  settingsLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
  },
  settingsLinkLabel: {
    color: '#0369a1',
    fontWeight: '600',
  },
  segmentedRow: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    padding: 4,
    gap: 6,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#2563eb',
  },
  segmentLabel: {
    fontWeight: '600',
    color: '#374151',
  },
  segmentLabelActive: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
    textAlign: 'right',
  },
  button: {
    marginTop: 6,
    backgroundColor: '#111827',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
