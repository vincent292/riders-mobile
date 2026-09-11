import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { AppState } from "react-native";
import { useRiderAuth } from "@/context/rider-auth";
import { useAuthorized } from "./use-authorized";
import { getRiderPosition, locationMessage } from "@/lib/rider-location";
import { updateRiderLocation } from "@/lib/rider-api";
import { startBackgroundDelivery, stopBackgroundDelivery } from "@/lib/background-location";
import type { Coordinates } from "@/lib/geo";

export function useLiveRiderLocation(orderId: string, canReconcile: boolean) {
  const { session } = useRiderAuth();
  const runAuthorized = useAuthorized();
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState("Ubicación pendiente");
  const [background, setBackground] = useState(false);
  const [generation, setGeneration] = useState(0);
  const lastPositionAt = useRef(0);
  const userId = session?.user.id;
  const retry = useCallback(() => setGeneration((value) => value + 1), []);
  const locate = useCallback(async () => {
    const next = await getRiderPosition(true);
    lastPositionAt.current = next.timestamp;
    setPosition({ latitude: next.coords.latitude, longitude: next.coords.longitude });
    setStatus((next.coords.accuracy ?? 0) > 100 ? "GPS con baja precisión" : "GPS disponible");
    return next;
  }, []);

  useEffect(() => {
    if (!userId) {
      void stopBackgroundDelivery().catch(() => null);
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    let sending = false;
    let lastSentAt = 0;
    let receivedPosition = false;
    function receivePosition(next: Location.LocationObject) {
      if (cancelled || next.timestamp < lastPositionAt.current) return;
      receivedPosition = true;
      lastPositionAt.current = next.timestamp;
      const coords = { latitude: next.coords.latitude, longitude: next.coords.longitude };
      setPosition(coords);
      const lowAccuracy = (next.coords.accuracy ?? 0) > 100;
      setStatus(lowAccuracy ? "GPS con baja precisión" : "GPS disponible");
      if (!orderId || sending || Date.now() - lastSentAt < 15000) return;
      sending = true;
      lastSentAt = Date.now();
      void runAuthorized((token) => updateRiderLocation(token, orderId, { ...coords, accuracyMeters: next.coords.accuracy, heading: next.coords.heading, speedMetersPerSecond: next.coords.speed }))
        .then(() => { if (!cancelled) setStatus(lowAccuracy ? "Ubicación compartida · precisión baja" : "Ubicación compartida"); })
        .catch(() => { if (!cancelled) setStatus("Ubicación sin sincronizar"); })
        .finally(() => { sending = false; });
    }
    async function configureBackground() {
      if (orderId) {
        const enabled = await startBackgroundDelivery(orderId, userId!).catch(() => false);
        if (cancelled) return;
        if (!enabled) await stopBackgroundDelivery();
        if (!cancelled) setBackground(enabled);
      } else if (!cancelled) setBackground(false);
    }
    async function start() {
      if (!orderId && canReconcile) await stopBackgroundDelivery();
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && orderId && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (cancelled) return;
      if (!permission.granted) { setStatus("Permiso de ubicación pendiente"); setBackground(false); await stopBackgroundDelivery(); return; }
      if (!(await Location.hasServicesEnabledAsync())) { setStatus("Activa el GPS del teléfono"); return; }
      if (cancelled) return;
      setStatus("Obteniendo ubicación…");
      // Seed and publish a fresh position on acceptance, even without movement.
      // Background permissions/service startup must not hold up the visible map.
      void configureBackground().catch(() => { if (!cancelled) setBackground(false); });
      void getRiderPosition().then(receivePosition).catch((error) => {
        if (!cancelled && !receivedPosition) setStatus(locationMessage(error));
      });
      const watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 15000 }, receivePosition);
      if (cancelled) watcher.remove(); else subscription = watcher;
    }
    void start().catch((error) => { if (!cancelled) setStatus(locationMessage(error)); });
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") retry(); });
    const stale = setInterval(() => {
      if (lastPositionAt.current && Date.now() - lastPositionAt.current > 60000) setStatus("Ubicación sin actualizar recientemente");
    }, 15000);
    return () => { cancelled = true; subscription?.remove(); appState.remove(); clearInterval(stale); };
  }, [canReconcile, generation, orderId, retry, runAuthorized, userId]);
  return { position, status, background, retry, locate };
}
