import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { UserHeader } from '../../components/UserHeader';

const tabIcon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={name} size={focused ? 24 : 22} color={color} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#6b7280',
        headerTitleAlign: 'center',
        header: () => <UserHeader />,
      }}
    >
      <Tabs.Screen
        name="map/index"
        options={{
          title: 'Mapa',
          tabBarLabel: 'Mapa',
          tabBarIcon: tabIcon('map'),
        }}
      />
      <Tabs.Screen
        name="pois/index"
        options={{
          title: 'POI',
          tabBarLabel: 'POI',
          tabBarIcon: tabIcon('list'),
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: 'Usługi',
          tabBarLabel: 'Usługi',
          tabBarIcon: tabIcon('people'),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Ustawienia',
          tabBarLabel: 'Ustawienia',
          tabBarIcon: tabIcon('settings'),
        }}
      />
    </Tabs>
  );
}
