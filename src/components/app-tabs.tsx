import { Tabs } from 'expo-router';
import { Clock3, MapPinned, UserRound, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RiderColors, RiderFonts } from '@/constants/rider-theme';
import { useRiderAuth } from '@/context/rider-auth';
import { useRiderDashboard } from '@/context/rider-dashboard';
import { useClock } from '@/hooks/use-clock';
import { offerSeconds } from '@/lib/rider-domain';

const tabIcons: Record<string, LucideIcon> = {
  historial: Clock3,
  index: MapPinned,
  perfil: UserRound,
};

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const { activeOrder, offers } = useRiderDashboard();
  const now = useClock();
  const badge = activeOrder ? 1 : offers.filter((offer) => offerSeconds(offer.expiresAt, now) !== 0).length;
  const { pendingGoogleLink, session } = useRiderAuth();
  const hideTabs = !session || pendingGoogleLink;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: RiderColors.ink,
        tabBarInactiveTintColor: RiderColors.muted,
        tabBarStyle: {
          backgroundColor: RiderColors.white,
          borderTopColor: RiderColors.line,
          borderTopWidth: 1,
          display: hideTabs ? 'none' : 'flex',
          height: 64 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 7,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 18,
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
      <Tabs.Screen name="index" options={{ title: 'Entregas', tabBarBadge: badge || undefined, tabBarBadgeStyle: { backgroundColor: RiderColors.teal, color: RiderColors.white } }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="auth/callback" options={{ href: null, title: 'Auth' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    width: 48,
  },
  tabIconActive: {
    backgroundColor: RiderColors.lime,
  },
});
