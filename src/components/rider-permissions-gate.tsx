/* eslint-disable react-hooks/set-state-in-effect */
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { Bell, CheckCircle2, LocateFixed, Settings, type LucideIcon } from "lucide-react-native";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RiderAssets } from "@/constants/rider-assets";
import { RiderColors, RiderFonts } from "@/constants/rider-theme";
import { BrandedLoading, PrimaryButton, RiderScreen } from "./rider-ui";

type PermissionState = "checking" | "granted" | "denied" | "unavailable";

export function RiderPermissionsGate({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(true);
  const [location, setLocation] = useState<PermissionState>("checking");
  const [notifications, setNotifications] = useState<PermissionState>("checking");

  const requestAll = useCallback(async () => {
    setRequesting(true);

    const [notificationStatus, locationStatus] = await Promise.all([
      requestNotificationPermission(),
      requestLocationPermission(),
    ]);

    setNotifications(notificationStatus);
    setLocation(locationStatus);
    setRequested(true);
    setRequesting(false);
  }, []);

  useEffect(() => {
    void requestAll();
  }, [requestAll]);

  if (requesting && !requested) {
    return (
      <RiderScreen>
        <BrandedLoading message="Preparando permisos..." />
      </RiderScreen>
    );
  }

  if (requested && location === "granted") {
    return <>{children}</>;
  }

  return (
    <RiderScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.content}>
          <Image source={RiderAssets.illustrations.riderPhone} style={styles.hero} contentFit="contain" />
          <Text style={styles.title}>Activa tus permisos</Text>
          <Text style={styles.subtitle}>Yopido Riders necesita tu ubicacion para mostrar rutas y compartir avance durante una entrega.</Text>

          <View style={styles.card}>
            <PermissionRow
              icon={LocateFixed}
              required
              status={location}
              text="Mapa, distancia y ubicacion en tiempo real"
              title="Ubicacion"
            />
            <PermissionRow
              icon={Bell}
              status={notifications}
              text="Avisos cuando lleguen carreras nuevas"
              title="Notificaciones"
            />
          </View>

          <PrimaryButton onPress={() => void requestAll()}>
            {requesting ? <ActivityIndicator color={RiderColors.ink} /> : <Text style={styles.buttonDark}>Pedir permisos</Text>}
          </PrimaryButton>

          <Pressable onPress={() => void Linking.openSettings()} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
            <Settings color={RiderColors.white} size={18} strokeWidth={2.4} />
            <Text style={styles.settingsText}>Abrir configuracion</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </RiderScreen>
  );
}

async function requestNotificationPermission(): Promise<PermissionState> {
  try {
    if (Platform.OS === "android" && Constants.appOwnership === "expo") {
      return "unavailable";
    }

    const Notifications = await import("expo-notifications");

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("rider-dispatches", {
        importance: Notifications.AndroidImportance.MAX,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        name: "Carreras asignadas",
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const current = await Notifications.getPermissionsAsync();
    const finalStatus = current.granted ? current : await Notifications.requestPermissionsAsync();
    return finalStatus.granted ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

async function requestLocationPermission(): Promise<PermissionState> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    return permission.status === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

function PermissionRow({
  icon: Icon,
  required,
  status,
  text,
  title,
}: {
  icon: LucideIcon;
  required?: boolean;
  status: PermissionState;
  text: string;
  title: string;
}) {
  const granted = status === "granted";

  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionIcon}>
        <Icon color={RiderColors.blue900} size={21} strokeWidth={2.4} />
      </View>
      <View style={styles.permissionCopy}>
        <View style={styles.permissionTitleRow}>
          <Text style={styles.permissionTitle}>{title}</Text>
          {required ? <Text style={styles.required}>Necesario</Text> : null}
        </View>
        <Text style={styles.permissionText}>{text}</Text>
      </View>
      <CheckCircle2 color={granted ? RiderColors.limeDark : RiderColors.muted} size={22} strokeWidth={2.6} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 16,
    justifyContent: "center",
    padding: 22,
  },
  hero: {
    alignSelf: "center",
    height: 210,
    width: "92%",
  },
  title: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: RiderColors.white,
    fontFamily: RiderFonts.semibold,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    opacity: 0.84,
    textAlign: "center",
  },
  card: {
    backgroundColor: RiderColors.card,
    borderRadius: 24,
    overflow: "hidden",
  },
  permissionRow: {
    alignItems: "center",
    borderBottomColor: RiderColors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 86,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  permissionIcon: {
    alignItems: "center",
    backgroundColor: RiderColors.soft,
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  permissionCopy: {
    flex: 1,
  },
  permissionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  permissionTitle: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
  required: {
    color: RiderColors.orange,
    fontFamily: RiderFonts.black,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  permissionText: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },
  buttonDark: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
  settingsButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  settingsText: {
    color: RiderColors.white,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.7,
  },
});
