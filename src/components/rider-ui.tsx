import { Image } from 'expo-image';
import { Bell } from 'lucide-react-native';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { RiderAssets } from '@/constants/rider-assets';
import { RiderColors, RiderFonts } from '@/constants/rider-theme';

export function RiderScreen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function BrandedLoading({ message = 'Cargando tu ruta...' }: { message?: string }) {
  return (
    <View style={styles.loadingScreen}>
      <View style={styles.loadingBrand}>
        <Image source={RiderAssets.brand.logoLight} style={styles.loadingLogo} contentFit="contain" />
        <Text style={styles.loadingKicker}>Tu ruta, tus ganancias</Text>
      </View>
      <View style={styles.loadingScene}>
        <Image source={RiderAssets.reference.bannerDark} style={styles.loadingBanner} contentFit="cover" />
      </View>
      <View style={styles.loadingStatus}>
        <View style={styles.loadingBar}>
          <View style={styles.loadingFill} />
        </View>
        <ActivityIndicator color={RiderColors.lime} size="small" />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </View>
  );
}

export function RiderHeader({
  title,
  action,
  subtitle = 'En linea',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <View style={styles.headerMark}>
          <Image source={RiderAssets.icons.symbolLight} style={styles.headerMarkImage} contentFit="contain" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text numberOfLines={1} style={styles.statusText}>{subtitle}</Text>
          </View>
        </View>
      </View>
      {action ?? (
        <View style={styles.iconButton}>
          <Bell color={RiderColors.white} size={21} strokeWidth={2.5} />
        </View>
      )}
    </View>
  );
}

export function LogoMark({ compact = false, tone = 'light' }: { compact?: boolean; tone?: 'dark' | 'light' }) {
  const source = compact
    ? tone === 'dark'
      ? RiderAssets.icons.symbolDark
      : RiderAssets.icons.symbolLight
    : tone === 'dark'
      ? RiderAssets.brand.logoHorizontalDark
      : RiderAssets.brand.logoHorizontalLight;

  return <Image source={source} style={compact ? styles.logoCompact : styles.logo} contentFit="contain" />;
}

export function EmptyRidesState({
  text = 'Te avisaremos cuando aparezca una nueva carrera.',
  title = 'No hay carreras disponibles',
}: {
  text?: string;
  title?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Image source={RiderAssets.states.noRides} style={styles.emptyImage} contentFit="contain" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function MetricPill({ label, value, tone = 'dark' }: { label: string; value: string; tone?: 'dark' | 'lime' }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, tone === 'lime' && styles.metricValueLime]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  children,
  onPress,
  tone = 'lime',
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: 'lime' | 'red' | 'dark';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        tone === 'red' && styles.primaryButtonRed,
        tone === 'dark' && styles.primaryButtonDark,
        pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RiderColors.blue950,
  },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: RiderColors.blue950,
    flex: 1,
    gap: 22,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingBrand: {
    alignItems: 'center',
    gap: 4,
  },
  loadingLogo: {
    height: 76,
    width: 220,
  },
  loadingKicker: {
    color: RiderColors.white,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.82,
  },
  loadingScene: {
    aspectRatio: 2.37,
    borderColor: 'rgba(199,240,0,0.16)',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 360,
    overflow: 'hidden',
    width: '100%',
  },
  loadingBanner: {
    height: '100%',
    width: '100%',
  },
  loadingStatus: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 260,
    width: '100%',
  },
  loadingBar: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    height: 5,
    overflow: 'hidden',
    width: '78%',
  },
  loadingFill: {
    backgroundColor: RiderColors.lime,
    borderRadius: 999,
    height: '100%',
    width: '58%',
  },
  loadingText: {
    color: RiderColors.white,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 11,
  },
  headerMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerMarkImage: {
    height: 29,
    width: 29,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 19,
    fontWeight: '900',
  },
  statusRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: RiderColors.lime,
  },
  statusText: {
    color: RiderColors.lime,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  logo: {
    width: 188,
    height: 62,
  },
  logoCompact: {
    width: 54,
    height: 54,
  },
  metric: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 16,
    fontWeight: '900',
  },
  metricValueLime: {
    color: RiderColors.limeDark,
  },
  metricLabel: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: RiderColors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonRed: {
    backgroundColor: RiderColors.red,
  },
  primaryButtonDark: {
    backgroundColor: RiderColors.ink,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  sectionLabel: {
    color: RiderColors.white,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: RiderColors.card,
    borderRadius: 8,
    gap: 10,
    overflow: 'hidden',
    padding: 18,
  },
  emptyImage: {
    height: 118,
    width: '74%',
  },
  emptyTitle: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.semibold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
