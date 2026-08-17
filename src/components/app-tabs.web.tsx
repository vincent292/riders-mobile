import { TabList, TabSlot, TabTrigger, TabTriggerSlotProps, Tabs } from 'expo-router/ui';
import { Clock3, MapPinned, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RiderColors, RiderFonts } from '@/constants/rider-theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View style={styles.tabListContainer}>
          <TabTrigger name="mapa" href="/" asChild>
            <TabButton icon={MapPinned}>Mapa</TabButton>
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
  const color = isFocused ? RiderColors.lime : RiderColors.white;

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <Icon color={color} size={isFocused ? 24 : 22} strokeWidth={isFocused ? 2.9 : 2.2} />
      <Text style={[styles.label, isFocused && styles.active]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  tabListContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    minHeight: 68,
    borderRadius: 26,
    backgroundColor: RiderColors.blue950,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    color: RiderColors.white,
    fontFamily: RiderFonts.extraBold,
    fontSize: 12,
    fontWeight: '800',
  },
  active: {
    color: RiderColors.lime,
  },
  pressed: {
    opacity: 0.7,
  },
});
