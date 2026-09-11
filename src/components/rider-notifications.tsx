import Constants from "expo-constants";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState, Linking, Platform } from "react-native";
import { useRiderAuth } from "@/context/rider-auth";
import { useAuthorized } from "@/hooks/use-authorized";
import { registerRiderPushToken } from "@/lib/rider-api";
import { notifyRiderOrdersChanged } from "@/lib/rider-events";

type PushStatus = "checking" | "ready" | "denied" | "error" | "unsupported";
const PushContext = createContext<{ status: PushStatus; retry: () => Promise<void> }>({ status: "checking", retry: async () => {} });
export const useRiderNotifications = () => useContext(PushContext);
const supported = Platform.OS !== "web" && !(Platform.OS === "android" && Constants.appOwnership === "expo");

export function RiderNotifications({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session } = useRiderAuth();
  const run = useAuthorized();
  const [status, setStatus] = useState<PushStatus>(supported ? "checking" : "unsupported");
  const [generation, setGeneration] = useState(0);
  const riderId = session?.activeRiders[0]?.id ?? session?.riders[0]?.id;
  const userId = session?.user.id;
  const retry = useCallback(async () => {
    if (!supported) return;
    try {
      const Notifications = await import("expo-notifications");
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) {
        if (permission.canAskAgain) await Notifications.requestPermissionsAsync();
        else await Linking.openSettings();
      }
      setGeneration((value) => value + 1);
    } catch { setStatus("error"); }
  }, []);

  useEffect(() => {
    if (!userId || !supported) return;
    let cancelled = false;
    let received: { remove: () => void } | undefined;
    let response: { remove: () => void } | undefined;
    async function initialize() {
      const Notifications = await import("expo-notifications");
      if (cancelled) return;
      Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("rider-dispatch", {
        name: "Nuevas entregas", importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
      if (cancelled) return;
      received = Notifications.addNotificationReceivedListener(() => notifyRiderOrdersChanged());
      response = Notifications.addNotificationResponseReceivedListener((event) => {
        if (event.notification.request.content.data?.type === "rider_delivery_offer") {
          router.replace("/"); notifyRiderOrdersChanged();
          void Notifications.clearLastNotificationResponseAsync();
        }
      });
      const last = Notifications.getLastNotificationResponse();
      if (last?.notification.request.content.data?.type === "rider_delivery_offer") {
        router.replace("/"); await Notifications.clearLastNotificationResponseAsync();
      }
      const permission = await Notifications.getPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) { setStatus("denied"); return; }
      setStatus("checking");
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) { setStatus("error"); return; }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (cancelled) return;
      await run((accessToken) => registerRiderPushToken(accessToken, {
        expoPushToken: token, riderId, platform: Platform.OS,
        appVersion: Constants.expoConfig?.version,
        deviceId: [Device.brand, Device.modelName].filter(Boolean).join(" "),
      }));
      if (!cancelled) setStatus("ready");
    }
    void initialize().catch(() => { if (!cancelled) setStatus("error"); });
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") setGeneration((value) => value + 1); });
    return () => { cancelled = true; received?.remove(); response?.remove(); appState.remove(); };
  }, [generation, riderId, router, run, userId]);
  return <PushContext.Provider value={{ status, retry }}>{children}</PushContext.Provider>;
}
