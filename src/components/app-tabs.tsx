import { Tabs } from 'expo-router';
import { Clock3, MapPinned, UserRound, type LucideIcon } from 'lucide-react-native';

import { RiderColors, RiderFonts } from '@/constants/rider-theme';
import { useRiderAuth } from '@/context/rider-auth';

const tabIcons: Record<string, LucideIcon> = {
  historial: Clock3,
  index: MapPinned,
  perfil: UserRound,
};

export default function AppTabs() {
  const { pendingGoogleLink, session } = useRiderAuth();
  const hideTabs = !session || pendingGoogleLink;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: RiderColors.lime,
        tabBarInactiveTintColor: RiderColors.white,
        tabBarStyle: {
          backgroundColor: RiderColors.blue950,
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          display: hideTabs ? 'none' : 'flex',
          height: 76,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: RiderFonts.extraBold,
          fontSize: 12,
          fontWeight: '800',
        },
        tabBarIcon: ({ color, focused }) => {
          const Icon = tabIcons[route.name] ?? MapPinned;
          return <Icon color={color} size={focused ? 24 : 22} strokeWidth={focused ? 2.9 : 2.2} />;
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="auth/callback" options={{ href: null, title: 'Auth' }} />
    </Tabs>
  );
}
