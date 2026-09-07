import { TabList, TabSlot, TabTrigger, TabTriggerSlotProps, Tabs } from 'expo-router/ui';
import { Clock3, MapPinned, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RiderColors, RiderFonts } from '@/constants/rider-theme';
import { useRiderAuth } from '@/context/rider-auth';

export default function AppTabs() {
  const { pendingGoogleLink, session } = useRiderAuth();
  const hideTabs = !session || pendingGoogleLink;

  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View style={hideTabs ? styles.hiddenTabList : styles.tabListContainer}>
          <TabTrigger name="mapa" href="/" asChild>
            <TabButton icon={MapPinned}>Entregas</TabButton>
          </TabTrigger>
          <TabTrigger name="historial" href="/historial" asChild>
            <TabButton icon={Clock3}>Historial</TabButton>
          </TabTrigger>
          <TabTrigger name="perfil" href="/perfil" asChild>
            <TabButton icon={UserRound}>Perfil</TabButton>
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, icon: Icon, isFocused, ...props }: TabTriggerSlotProps & { icon: LucideIcon }) {
  const color = isFocused ? RiderColors.teal : RiderColors.muted;

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <Icon color={color} size={isFocused ? 24 : 22} strokeWidth={isFocused ? 2.9 : 2.2} />
      <Text style={[styles.label, isFocused && styles.active]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  tabListContainer: {
    minHeight: 68,
    backgroundColor: RiderColors.white,
    borderTopWidth: 1,
    borderColor: RiderColors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
  },
  hiddenTabList: {
    display: 'none',
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  active: {
    color: RiderColors.teal,
  },
  pressed: {
    opacity: 0.7,
  },
});
