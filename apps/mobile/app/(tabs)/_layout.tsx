import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#262626' },
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#737373',
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'For You',
          tabBarLabel: 'For You',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⌕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlists',
          tabBarLabel: 'Playlists',
          tabBarIcon: ({ focused }) => <TabIcon symbol="☰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
