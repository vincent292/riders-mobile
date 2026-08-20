import Constants from "expo-constants";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useRiderAuth } from "@/context/rider-auth";
import { registerRiderPushToken } from "@/lib/rider-api";
import { notifyRiderOrdersChanged } from "@/lib/rider-events";

const riderChannelId = "rider-dispatch";

export function RiderNotifications() {
  const router = useRouter();
  const { session } = useRiderAuth();
  const accessToken = session?.accessToken ?? "";
  const riderId = session?.activeRiders[0]?.id ?? session?.riders[0]?.id;

  useEffect(() => {
    if (!accessToken || Platform.OS === "web") return;
    if (Platform.OS === "android" && Constants.appOwnership === "expo") return;

    let cancelled = false;

    async function register() {
      const Notifications = await import("expo-notifications");

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(riderChannelId, {
          importance: Notifications.AndroidImportance.MAX,
          lightColor: "#C7F000",
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          name: "Carreras asignadas",
          sound: "default",
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const currentPermission = await Notifications.getPermissionsAsync();
      const permission = currentPermission.granted
        ? currentPermission
        : await Notifications.requestPermissionsAsync();
      if (!permission.granted || cancelled) return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;

      const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (cancelled) return;

      await registerRiderPushToken(accessToken, {
        appVersion: Constants.expoConfig?.version,
        deviceId: [Device.brand, Device.modelName].filter(Boolean).join(" ") || undefined,
        expoPushToken,
        platform: Platform.OS,
        riderId,
      });
    }

    void register().catch((error) => {
      console.warn("rider-push-registration-failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, riderId]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android" && Constants.appOwnership === "expo") return;

    let receivedSubscription: { remove: () => void } | undefined;
    let responseSubscription: { remove: () => void } | undefined;
    let cancelled = false;

    async function listen() {
      const Notifications = await import("expo-notifications");
      if (cancelled) return;

      receivedSubscription = Notifications.addNotificationReceivedListener(() => {
        notifyRiderOrdersChanged();
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const type = response.notification.request.content.data?.type;
        if (type === "rider_delivery_offer") {
          router.replace("/");
          notifyRiderOrdersChanged();
        }
      });

      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse?.notification.request.content.data?.type === "rider_delivery_offer") {
        router.replace("/");
      }
    }

    void listen().catch(() => null);

    return () => {
      cancelled = true;
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [router]);

  return null;
}
