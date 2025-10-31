import MapLibreGL from '@maplibre/maplibre-react-native';
import { circle, featureCollection, point } from '@turf/turf';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Feature, FeatureCollection, Polygon, Point } from 'geojson';
import { useSettings } from '../../../context/SettingsContext';
import useLiveLocation from '../../../hooks/useLiveLocation';
import { POIS } from '../../../lib/geofencing';
import { ensureForegroundPermissions, openSystemLocationSettings } from '../../../lib/permissions';

type TutorialHighlight = 'mapArea' | 'centerButton' | 'styleButton';

type TutorialStep = {
  title: string;
  description: string;
  highlight?: TutorialHighlight;
  actionLabel?: string;
  onAction?: () => void;
};

const INITIAL_COORDINATE: [number, number] = [33.3823, 35.1856];

export default function MapScreen() {
  const { activeMapStyle, toggleMapStyle, distanceInterval, timeInterval, accuracy, mapStyles } = useSettings();
  const { latitude, longitude, location, permissionStatus, requestForegroundPermissions, error } =
    useLiveLocation({
      distanceInterval,
      timeInterval,
      accuracy,
    });
  const insets = useSafeAreaInsets();
  const controlsTopOffset = insets.top + 120;
  const cameraRef = useRef<MapLibreGL.Camera>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [selectedPoiIndex, setSelectedPoiIndex] = useState<number | null>(null);
  const canToggleMapStyle = mapStyles.length > 1;

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 14,
        animationDuration: hasCentered ? 800 : 0,
      });
      setHasCentered(true);
    }
  }, [latitude, longitude, hasCentered]);

  const geofencePolygons = useMemo<FeatureCollection<Polygon>>(
    () =>
      featureCollection(
        POIS.map((poi) =>
          circle([poi.lon, poi.lat], poi.radius / 1000, {
            steps: 64,
            properties: { id: poi.id, name: poi.name, radius: poi.radius },
          }),
        ),
      ) as FeatureCollection<Polygon>,
    []
  );

  const poiPoints = useMemo<FeatureCollection<Point>>(
    () =>
      featureCollection(
        POIS.map((poi) =>
          point([poi.lon, poi.lat], {
            id: poi.id,
            name: poi.name,
          }),
        ),
      ) as FeatureCollection<Point>,
    []
  );

  const accuracyCircle = useMemo<Feature<Polygon> | null>(() => {
    if (!location?.coords || !location.coords.accuracy || !latitude || !longitude) {
      return null;
    }
    const radius = Math.max(location.coords.accuracy, 15) / 1000;
    return circle([longitude, latitude], radius, { steps: 48 }) as Feature<Polygon>;
  }, [latitude, location?.coords, longitude]);

  const userPoint = useMemo<Feature<Point> | null>(() => {
    if (latitude === null || longitude === null) {
      return null;
    }
    return point([longitude, latitude]) as Feature<Point>;
  }, [latitude, longitude]);

  const handleCenterOnUser = useCallback(async () => {
    const permission = await ensureForegroundPermissions();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      Alert.alert(
        'Brak dostępu do lokalizacji',
        'Nadaj uprawnienia w ustawieniach, aby zobaczyć swoją pozycję.',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Otwórz ustawienia',
            onPress: () => {
              openSystemLocationSettings().catch(() => undefined);
            },
          },
        ],
      );
      return;
    }
    if (latitude !== null && longitude !== null) {
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 15,
        animationDuration: 600,
      });
    }
  }, [latitude, longitude]);

  // Centruj mapę na wybranym POI
  useEffect(() => {
    if (selectedPoiIndex !== null && selectedPoiIndex >= 0 && selectedPoiIndex < POIS.length) {
      const poi = POIS[selectedPoiIndex];
      console.log(`Centrowanie na: ${poi.name} (${poi.lat}, ${poi.lon})`);
      
      // Użyj setTimeout dla pewności że mapa jest gotowa
      const timer = setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [poi.lon, poi.lat],
          zoomLevel: 15,
          animationDuration: 800,
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedPoiIndex]);

  const handlePoiPress = useCallback((event: any) => {
    const feature = event?.features?.[0];
    if (feature?.geometry?.coordinates && feature.properties?.id) {
      // Znajdź index POI na podstawie ID
      const poiIndex = POIS.findIndex(poi => poi.id === feature.properties.id);
      if (poiIndex !== -1) {
        setSelectedPoiIndex(poiIndex);
      }
    } else {
      console.log('Brak współrzędnych w klikniętym punkcie', event);
    }
  }, []);

  const handlePreviousPoi = useCallback(() => {
    setSelectedPoiIndex(prev => {
      if (prev === null || prev <= 0) {
        return POIS.length - 1; // Zawijaj do ostatniego
      }
      return prev - 1;
    });
  }, []);

  const handleNextPoi = useCallback(() => {
    setSelectedPoiIndex(prev => {
      if (prev === null || prev >= POIS.length - 1) {
        return 0; // Zawijaj do pierwszego
      }
      return prev + 1;
    });
  }, []);

  const tutorialSteps = useMemo<TutorialStep[]>(() => {
    const steps: TutorialStep[] = [
      {
        title: 'Poznaj Cyprus Explorer',
        description:
          'Nasza mapa pokazuje atrakcje oraz strefy geofencingowe, abyś mógł szybko zaplanować pobyt. Zacznijmy krótkie oprowadzenie!',
        highlight: 'mapArea',
      },
      {
        title: 'Twoja pozycja',
        description:
          'Dotknij „Centrum na mnie”, aby natychmiast zobaczyć swoją lokalizację i najbliższe punkty usługowe.',
        highlight: 'centerButton',
        actionLabel: 'Centrum na mnie',
        onAction: handleCenterOnUser,
      },
    ];

    if (canToggleMapStyle) {
      steps.push({
        title: 'Personalizuj mapę',
        description:
          'Przełącz style mapy, aby dopasować widok do terenu i trybu dnia. Dzięki temu łatwiej odnajdziesz interesujące miejsca.',
        highlight: 'styleButton',
        actionLabel: 'Przełącz styl',
        onAction: toggleMapStyle,
      });
    }

    return steps;
  }, [canToggleMapStyle, handleCenterOnUser, toggleMapStyle]);

  const highlightLayouts = useMemo<Record<TutorialHighlight, ViewStyle>>(
    () => ({
      mapArea: {
        top: insets.top + 90,
        left: 20,
        right: 20,
        bottom: insets.bottom + 140,
      },
      centerButton: {
        top: controlsTopOffset,
        right: 12,
        width: 170,
        height: 44,
      },
      styleButton: {
        top: controlsTopOffset + 54,
        right: 12,
        width: 170,
        height: 44,
      },
    }),
    [controlsTopOffset, insets.bottom, insets.top],
  );

  useFocusEffect(
    useCallback(() => {
      if (permissionStatus === Location.PermissionStatus.GRANTED) {
        return;
      }
      requestForegroundPermissions().catch(() => undefined);
    }, [permissionStatus, requestForegroundPermissions]),
  );

  const showPermissionBanner = permissionStatus !== Location.PermissionStatus.GRANTED || !!error;

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const handleSkipTutorial = useCallback(() => {
    closeTutorial();
  }, [closeTutorial]);

  useEffect(() => {
    setTutorialStep((prev) => {
      if (!tutorialSteps.length) {
        return 0;
      }
      return Math.min(prev, tutorialSteps.length - 1);
    });
  }, [tutorialSteps.length]);

  useEffect(() => {
    if (showTutorial && !tutorialSteps.length) {
      setShowTutorial(false);
    }
  }, [showTutorial, tutorialSteps.length]);

  const safeTutorialStep = Math.min(tutorialStep, Math.max(tutorialSteps.length - 1, 0));
  const handleNextStep = useCallback(() => {
    if (tutorialSteps.length === 0) {
      closeTutorial();
      return;
    }
    if (safeTutorialStep < tutorialSteps.length - 1) {
      setTutorialStep((prev) => {
        if (tutorialSteps.length === 0) {
          return 0;
        }
        return Math.min(prev + 1, tutorialSteps.length - 1);
      });
      return;
    }
    closeTutorial();
  }, [closeTutorial, safeTutorialStep, tutorialSteps.length]);

  const handleStartTutorial = useCallback(() => {
    if (!tutorialSteps.length) {
      return;
    }
    setTutorialStep(0);
    setShowTutorial(true);
  }, [tutorialSteps.length]);
  const currentStep = tutorialSteps[safeTutorialStep];
  const currentHighlightStyle = currentStep?.highlight ? highlightLayouts[currentStep.highlight] : undefined;
  const shouldShowTutorial = showTutorial && !!currentStep;

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView styleURL={activeMapStyle.url} style={styles.map} logoEnabled={false}>
        <MapLibreGL.Camera
          ref={cameraRef}
          zoomLevel={10}
          centerCoordinate={INITIAL_COORDINATE}
          animationDuration={0}
        />

        {accuracyCircle && (
          <MapLibreGL.ShapeSource id="user-accuracy" shape={accuracyCircle}>
            <MapLibreGL.FillLayer
              id="user-accuracy-layer"
              style={{ fillColor: 'rgba(37, 99, 235, 0.15)', fillOutlineColor: 'rgba(37,99,235,0.3)' }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {userPoint && (
          <MapLibreGL.ShapeSource id="user-location" shape={userPoint}>
            <MapLibreGL.CircleLayer
              id="user-location-layer"
              style={{ circleRadius: 6, circleColor: '#2563eb', circleStrokeColor: '#ffffff', circleStrokeWidth: 2 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        <MapLibreGL.ShapeSource id="geofences" shape={geofencePolygons}>
          <MapLibreGL.FillLayer
            id="geofence-fill"
            style={{ fillColor: 'rgba(16, 185, 129, 0.2)', fillOutlineColor: 'rgba(5, 150, 105, 0.8)' }}
          />
        </MapLibreGL.ShapeSource>

        <MapLibreGL.ShapeSource id="pois" shape={poiPoints} onPress={handlePoiPress} hitbox={{ width: 20, height: 20 }}>
          <MapLibreGL.CircleLayer
            id="poi-layer"
            style={{ circleColor: '#f97316', circleRadius: 8, circleStrokeWidth: 2, circleStrokeColor: '#fff' }}
          />
          <MapLibreGL.SymbolLayer
            id="poi-labels"
            style={{
              textField: ['get', 'name'],
              textSize: 12,
              textAnchor: 'top',
              textOffset: [0, 1],
              textColor: '#1f2937',
              textHaloColor: '#ffffff',
              textHaloWidth: 1,
            }}
          />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topBarTitle}>Potrzebujesz pomocy?</Text>
        <TouchableOpacity style={styles.topBarButton} onPress={handleStartTutorial}>
          <Text style={styles.topBarButtonText}>Uruchom samouczek</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.attributionContainer, { bottom: insets.bottom + 90 }]}>
        <Text style={styles.attributionText}>© MapLibre, © OpenStreetMap contributors</Text>
      </View>

      <View style={[styles.poiNavigator, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.navButton} onPress={handlePreviousPoi}>
          <Text style={styles.navButtonText}>← Poprzedni</Text>
        </TouchableOpacity>
        <View style={styles.poiInfo}>
          <Text style={styles.poiCounter}>
            {selectedPoiIndex !== null ? `${selectedPoiIndex + 1} / ${POIS.length}` : `-- / ${POIS.length}`}
          </Text>
          {selectedPoiIndex !== null && (
            <Text style={styles.poiName} numberOfLines={1}>
              {POIS[selectedPoiIndex].name}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.navButton} onPress={handleNextPoi}>
          <Text style={styles.navButtonText}>Następny →</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.controls, { top: controlsTopOffset }]}>
        <TouchableOpacity style={styles.controlButton} onPress={handleCenterOnUser}>
          <Text style={styles.controlLabel}>Centrum na mnie</Text>
        </TouchableOpacity>
        {canToggleMapStyle && (
          <TouchableOpacity style={styles.controlButton} onPress={toggleMapStyle}>
            <Text style={styles.controlLabel}>Przełącz styl</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.controlButton} onPress={handleStartTutorial}>
          <Text style={styles.controlLabel}>Samouczek</Text>
        </TouchableOpacity>
      </View>

      {showPermissionBanner && (
        <View style={[styles.permissionBanner, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.permissionText}>
            Potrzebujemy dostępu do lokalizacji aby pokazać Twoją pozycję i obsłużyć geostrefy.
          </Text>
          {error && <Text style={styles.permissionError}>{error}</Text>}
          <TouchableOpacity
            style={[styles.controlButton, styles.permissionButton]}
            onPress={() => {
              if (Platform.OS === 'android') {
                openSystemLocationSettings().catch(() => undefined);
              } else {
                requestForegroundPermissions().catch(() => undefined);
              }
            }}
          >
            <Text style={[styles.controlLabel, styles.permissionButtonText]}>Nadaj uprawnienia</Text>
          </TouchableOpacity>
        </View>
      )}

      {shouldShowTutorial && currentStep && (
        <Modal
          animationType="fade"
          transparent
          visible
          onRequestClose={handleSkipTutorial}
        >
          <View
            style={[
              styles.tutorialModalBackdrop,
              { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
            ]}
          >
            {currentHighlightStyle && (
              <View style={[styles.tutorialHighlight, currentHighlightStyle]} pointerEvents="none" />
            )}
            <View style={styles.tutorialCard}>
              <View style={styles.tutorialHeader}>
                <Text style={styles.tutorialTitle}>{currentStep.title}</Text>
                <TouchableOpacity onPress={handleSkipTutorial}>
                  <Text style={styles.tutorialSkip}>Pomiń</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.tutorialDescription}>{currentStep.description}</Text>
              {currentStep.actionLabel && currentStep.onAction && (
                <TouchableOpacity
                  style={styles.tutorialActionButton}
                  onPress={() => {
                    currentStep.onAction?.();
                  }}
                >
                  <Text style={styles.tutorialActionText}>{currentStep.actionLabel}</Text>
                </TouchableOpacity>
              )}
              <View style={styles.tutorialFooter}>
                <Text style={styles.tutorialStepIndicator}>
                  {safeTutorialStep + 1} / {tutorialSteps.length}
                </Text>
                <TouchableOpacity style={styles.tutorialButton} onPress={handleNextStep}>
                  <Text style={styles.tutorialButtonText}>
                    {safeTutorialStep === tutorialSteps.length - 1 ? 'Zakończ' : 'Dalej'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    right: 12,
    gap: 10,
    zIndex: 10,
  },
  controlButton: {
    backgroundColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  controlLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  attributionContainer: {
    position: 'absolute',
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  attributionText: {
    fontSize: 11,
    color: '#4b5563',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 12,
  },
  topBarTitle: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  topBarButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  topBarButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  permissionBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 10,
  },
  permissionText: {
    color: '#7f1d1d',
    fontSize: 14,
    lineHeight: 20,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  permissionError: {
    color: '#991b1b',
    fontSize: 12,
    lineHeight: 18,
  },
  tutorialModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  tutorialCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    zIndex: 2,
  },
  tutorialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 16,
  },
  tutorialSkip: {
    color: '#2563eb',
    fontWeight: '600',
  },
  tutorialDescription: {
    fontSize: 16,
    lineHeight: 22,
    color: '#374151',
  },
  tutorialHighlight: {
    position: 'absolute',
    borderColor: 'rgba(59, 130, 246, 0.9)',
    borderWidth: 2,
    borderRadius: 18,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tutorialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tutorialStepIndicator: {
    fontSize: 14,
    color: '#6b7280',
  },
  tutorialButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  tutorialButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  tutorialActionButton: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  tutorialActionText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 14,
  },
  poiNavigator: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  navButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 110,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  poiInfo: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  poiCounter: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  poiName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
