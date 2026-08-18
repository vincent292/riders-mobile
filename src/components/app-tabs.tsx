import { Tabs } from 'expo-router';
import { Clock3, MapPinned, UserRound, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

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
          backgroundColor: '#08111D',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          display: hideTabs ? 'none' : 'flex',
          height: 72,
          paddingBottom: 8,
          paddingTop: 7,
        },
        tabBarLabelStyle: {
          fontFamily: RiderFonts.extraBold,
          fontSize: 11,
          fontWeight: '800',
        },
        tabBarIcon: ({ color, focused }) => {
          const Icon = tabIcons[route.name] ?? MapPinned;
          return (
            <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
              <Icon color={focused ? RiderColors.ink : color} size={21} strokeWidth={focused ? 2.8 : 2.2} />
            </View>
          );
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="auth/callback" options={{ href: null, title: 'Auth' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 42,
  },
  tabIconActive: {
    backgroundColor: RiderColors.lime,
  },
});
