import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import poisSource from '../assets/pois.json';

export type GeofencePOI = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius: number;
};

export const GEOFENCE_TASK = 'GEOFENCE_TASK';

export const POIS: GeofencePOI[] = poisSource as GeofencePOI[];

const poiMap = new Map(POIS.map((poi) => [poi.id, poi]));

if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Błąd geofencingu', error);
      return;
    }
    const payload = data as {
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };
    if (!payload?.region) {
      return;
    }

    const { region, eventType } = payload;
    const poi = poiMap.get(region.identifier ?? '');
    const name = poi?.name ?? region.identifier ?? 'strefę';
    const enter = eventType === Location.GeofencingEventType.Enter;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: enter ? 'Witaj w strefie!' : 'Opuszczono strefę',
        body: `${enter ? 'Wszedłeś do' : 'Opuściłeś'} strefę ${name}.`,
        data: { region: region.identifier, type: enter ? 'ENTER' : 'EXIT' },
      },
      trigger: null,
    });
  });
}

export const geofenceRegions: Location.LocationRegion[] = POIS.map((poi) => ({
  identifier: poi.id,
  latitude: poi.lat,
  longitude: poi.lon,
  radius: poi.radius,
  notifyOnEnter: true,
  notifyOnExit: true,
}));

export const startGeofencing = async (regions: Location.LocationRegion[] = geofenceRegions) => {
  if (!regions.length) {
    return false;
  }
  const hasPermission = await Location.getBackgroundPermissionsAsync();
  if (hasPermission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Brak uprawnień do śledzenia w tle.');
  }
  await Notifications.requestPermissionsAsync();
  const alreadyStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (alreadyStarted) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  return true;
};

export const stopGeofencing = async () => {
  const alreadyStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (alreadyStarted) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
};
