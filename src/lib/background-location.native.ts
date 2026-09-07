import Constants from "expo-constants";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { fetchRiderDashboard, updateRiderLocation } from "./rider-api";
import { isActiveDelivery } from "./rider-domain";
import { getSupabaseClient } from "./supabase";

const taskName = "yopido-active-delivery-location";
const deliveryKey = "yopido-tracked-delivery";
const preferenceKey = "yopido-background-location-enabled";
const supported = Platform.OS === "android" && Constants.appOwnership !== "expo";
let sending = false;
let lifecycle: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = lifecycle.then(operation, operation);
  lifecycle = next.catch(() => undefined);
  return next;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(taskName, async ({ data, error }) => {
  if (error || !data?.locations.length || sending) return;
  sending = true;
  try {
    const record = await SecureStore.getItemAsync(deliveryKey);
    const stored = await SecureStore.getItemAsync("riders-mobile-session-v1");
    if (!record || !stored) { await stopBackgroundDelivery(); return; }
    const delivery = JSON.parse(record) as { orderId: string; userId: string; expiresAt: number };
    const session = JSON.parse(stored) as { accessToken: string; user: { id: string } };
    if (delivery.expiresAt < Date.now() || delivery.userId !== session.user.id) { await stopBackgroundDelivery(); return; }
    const supabase = getSupabaseClient();
    const refreshed = await supabase?.auth.getSession();
    const authSession = refreshed?.data.session;
    const token = authSession?.user.id === delivery.userId ? authSession.access_token : session.accessToken;
    // Reconcile remote cancellations/completions before publishing another position.
    const dashboard = await fetchRiderDashboard(token, false);
    if (!dashboard.mine.some((order) => order.id === delivery.orderId && isActiveDelivery(order))) {
      await stopBackgroundDelivery(); return;
    }
    if (await SecureStore.getItemAsync(deliveryKey) !== record) return;
    const position = data.locations[data.locations.length - 1];
    if (Date.now() - position.timestamp > 120000) return;
    await updateRiderLocation(token, delivery.orderId, {
      latitude: position.coords.latitude, longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy, heading: position.coords.heading,
      speedMetersPerSecond: position.coords.speed,
    });
  } catch {
    // Keep only the newest sample; the next OS update retries after connectivity returns.
  } finally { sending = false; }
});

export async function backgroundDeliveryEnabled() {
  return supported && await SecureStore.getItemAsync(preferenceKey) === "true" &&
    (await Location.getBackgroundPermissionsAsync()).granted;
}

export async function requestBackgroundDelivery() {
  if (!supported || !(await TaskManager.isAvailableAsync())) return false;
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return false;
  const permission = await Location.requestBackgroundPermissionsAsync();
  if (permission.granted) await SecureStore.setItemAsync(preferenceKey, "true");
  return permission.granted;
}

export async function startBackgroundDelivery(orderId: string, userId: string) {
  return serialize(async () => {
  if (!(await backgroundDeliveryEnabled())) return false;
  await SecureStore.setItemAsync(deliveryKey, JSON.stringify({ orderId, userId, expiresAt: Date.now() + 12 * 60 * 60 * 1000 }));
  if (!(await Location.hasStartedLocationUpdatesAsync(taskName))) {
    await Location.startLocationUpdatesAsync(taskName, {
      accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 15000,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "Yopido · Entrega en curso",
        notificationBody: "Compartiendo tu ubicación durante esta entrega.",
        notificationColor: "#C7F000", killServiceOnDestroy: true,
      },
    });
  }
  return true;
  });
}

export async function stopBackgroundDelivery() {
  return serialize(async () => {
  if (!supported) return;
  await SecureStore.deleteItemAsync(deliveryKey);
  if (await Location.hasStartedLocationUpdatesAsync(taskName)) await Location.stopLocationUpdatesAsync(taskName);
  });
}
