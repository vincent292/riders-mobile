import { Image } from 'expo-image';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { RiderAssets } from '@/constants/rider-assets';
import { RiderColors, RiderFonts } from '@/constants/rider-theme';

export function RiderScreen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function BrandedLoading({ message = 'Cargando tu ruta...' }: { message?: string }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1450, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 1450, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    progressLoop.start();
    pulseLoop.start();
    return () => { progressLoop.stop(); pulseLoop.stop(); };
  }, [progress, pulse]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-76, 76] });
  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] });

  return (
    <View style={styles.loadingScreen}>
      <View style={styles.loadingGlowOne} />
      <View style={styles.loadingGlowTwo} />
      <View style={styles.loadingBrand}>
        <Animated.View style={[styles.loadingLogoShell, { transform: [{ scale: logoScale }] }]}>
          <Animated.View style={[styles.loadingLogoGlow, { opacity: glowOpacity }]} />
          <Image source={RiderAssets.brand.logoLight} style={styles.loadingLogo} contentFit="contain" />
        </Animated.View>
        <Text style={styles.loadingKicker}>TU RUTA · TUS GANANCIAS</Text>
      </View>
      <View style={styles.loadingScene}>
        <Image source={RiderAssets.reference.bannerDark} style={styles.loadingBanner} contentFit="cover" />
        <View style={styles.loadingSceneOverlay} />
        <View style={styles.loadingSceneBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.loadingSceneBadgeText}>Conectando con tu zona</Text>
        </View>
      </View>
      <View style={styles.loadingStatus}>
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingRunner, { transform: [{ translateX }] }]} />
        </View>
        <Text style={styles.loadingText}>{message}</Text>
        <Text style={styles.loadingHint}>Preparando pedidos, ubicación y disponibilidad</Text>
      </View>
    </View>
  );
}

export function RiderHeader({
  title,
  action,
  subtitle = 'Yopido Riders',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <View style={styles.headerMark}>
          <Image source={RiderAssets.icons.symbolDark} style={styles.headerMarkImage} contentFit="contain" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>{subtitle}</Text>
          </View>
        </View>
      </View>
      {action}
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
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: 'lime' | 'red' | 'dark';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        tone === 'red' && styles.primaryButtonRed,
        tone === 'dark' && styles.primaryButtonDark,
        pressed && styles.pressed,
        (disabled || loading) && { opacity: 0.55 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={tone === 'lime' ? RiderColors.ink : RiderColors.white} /> : children}
    </Pressable>
  );
}

export function StatusNotice({ text, onRetry, tone = 'warning' }: { text: string; onRetry?: () => void; tone?: 'warning' | 'error' }) {
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: tone === 'error' ? RiderColors.dangerSoft : RiderColors.warning, padding: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <AlertCircle color={tone === 'error' ? RiderColors.red : RiderColors.orange} size={20} />
    <Text style={{ flex: 1, color: RiderColors.ink, fontFamily: RiderFonts.regular, fontSize: 13, lineHeight: 20 }}>{text}</Text>
    {onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={onRetry} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={20} color={RiderColors.ink} /></Pressable> : null}
  </View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RiderColors.soft,
  },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: RiderColors.blue950,
    flex: 1,
    gap: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 28,
  },
  loadingGlowOne: { position: 'absolute', width: 290, height: 290, borderRadius: 145, backgroundColor: 'rgba(199,240,0,0.08)', top: -100, right: -120 },
  loadingGlowTwo: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(18,53,91,0.72)', bottom: -80, left: -110 },
  loadingBrand: { alignItems: 'center', gap: 7 },
  loadingLogoShell: { alignItems: 'center', justifyContent: 'center', height: 96, width: 250 },
  loadingLogoGlow: { position: 'absolute', width: 178, height: 64, borderRadius: 32, backgroundColor: RiderColors.lime },
  loadingLogo: {
    height: 82,
    width: 232,
  },
  loadingKicker: {
    color: RiderColors.white,
    fontFamily: RiderFonts.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.72,
  },
  loadingScene: {
    aspectRatio: 2.37,
    borderColor: 'rgba(199,240,0,0.16)',
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 360,
    overflow: 'hidden',
    width: '100%',
  },
  loadingBanner: {
    height: '100%',
    width: '100%',
  },
  loadingSceneOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,13,23,0.18)' },
  loadingSceneBadge: { position: 'absolute', left: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(6,13,23,0.78)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: RiderColors.lime },
  loadingSceneBadgeText: { color: RiderColors.white, fontFamily: RiderFonts.bold, fontSize: 10, fontWeight: '700' },
  loadingStatus: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 260,
    width: '100%',
  },
  loadingTrack: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, height: 5, overflow: 'hidden', width: 170 },
  loadingRunner: { alignSelf: 'center', backgroundColor: RiderColors.lime, borderRadius: 999, height: '100%', shadowColor: RiderColors.lime, shadowOpacity: 0.8, shadowRadius: 8, width: 64 },
  loadingText: {
    color: RiderColors.white,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  loadingHint: { color: 'rgba(255,255,255,0.55)', fontFamily: RiderFonts.semibold, fontSize: 10, lineHeight: 15, textAlign: 'center' },
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
    backgroundColor: RiderColors.lime,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
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
    color: RiderColors.ink,
    fontFamily: RiderFonts.bold,
    fontSize: 19,
    fontWeight: '700',
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
    color: RiderColors.muted,
    fontFamily: RiderFonts.regular,
    fontSize: 12,
    fontWeight: '400',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
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
    borderRadius: 16,
    backgroundColor: RiderColors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
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
    color: RiderColors.ink,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 16,
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
    fontFamily: RiderFonts.bold,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.regular,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
