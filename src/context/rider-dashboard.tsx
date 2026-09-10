import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Haptics from "expo-haptics";
import type { LocationObject } from "expo-location";
import { useRiderAuth } from "./rider-auth";
import { useAuthorized } from "@/hooks/use-authorized";
import { useLiveRiderLocation } from "@/hooks/use-live-rider-location";
import { acceptRiderOffer, acceptRiderOrder, fetchRiderDashboard, rejectRiderOffer, rejectRiderOrder, riderErrorMessage, updateRiderAvailability, updateRiderOrderStatus, type MobileRiderOrder, type RiderDashboardPayload } from "@/lib/rider-api";
import { isActiveDelivery, offerSeconds } from "@/lib/rider-domain";
import { locationMessage } from "@/lib/rider-location";
import { notifyRiderOrdersChanged, subscribeToRiderOrderChanges } from "@/lib/rider-events";

export type RideOffer = { key: string; order: MobileRiderOrder; offerId?: string; expiresAt?: string };
const empty: RiderDashboardPayload = { available: [], offers: [], mine: [], updatedAt: "" };

function useDashboardState() {
  const { session, refreshSession, loading: authLoading } = useRiderAuth();
  const run = useAuthorized();
  const [data, setData] = useState(empty);
  const [available, setAvailable] = useState(Boolean(session?.availableToday));
  const availableRef = useRef(Boolean(session?.availableToday));
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState("");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const lock = useRef(false);
  const revision = useRef(0);
  const readId = useRef(0);
  const userId = authLoading ? undefined : session?.user.id;
  const activeOrders = data.mine.filter(isActiveDelivery);
  const activeOrder = activeOrders[0] ?? null;
  const activeOrderId = activeOrder?.id ?? "";
  const location = useLiveRiderLocation(activeOrderId, loaded);

  useEffect(() => () => {
    revision.current++;
    readId.current++;
  }, []);

  useEffect(() => {
    if (lock.current) return;
    const next = Boolean(session?.availableToday);
    availableRef.current = next;
    // Synchronize the availability snapshot refreshed by the authentication service.
    setAvailable(next);
  }, [session?.availableToday]);

  const refresh = useCallback(async (reconcile = false) => {
    if (!userId || (lock.current && !reconcile)) return;
    const request = ++readId.current;
    const currentRevision = revision.current;
    setRefreshing(true);
    try {
      const result = await run((token) => fetchRiderDashboard(token, availableRef.current));
      if (request !== readId.current || currentRevision !== revision.current) return;
      setData(result); setLoaded(true); setError(""); setLastSync(Date.now());
    } catch (err) {
      if (request === readId.current) setError(riderErrorMessage(err));
    } finally {
      if (request === readId.current) setRefreshing(false);
    }
  }, [run, userId]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, available || activeOrderId ? 20000 : 60000);
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
    const unsubscribe = subscribeToRiderOrderChanges(() => { void refresh(); });
    return () => { clearInterval(interval); sub.remove(); unsubscribe(); };
  }, [activeOrderId, available, refresh]);

  const mutate = useCallback(async (key: string, operation: () => Promise<void>) => {
    if (lock.current) return false;
    lock.current = true; revision.current++; readId.current++;
    setRefreshing(false); setPending(key); setActionError("");
    let success = false;
    try {
      await operation();
      success = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
    } catch (err) {
      setActionError(riderErrorMessage(err));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => null);
    } finally {
      notifyRiderOrdersChanged();
      await refresh(true);
      lock.current = false; setPending("");
    }
    return success;
  }, [refresh]);

  const toggleAvailability = useCallback((next: boolean) => mutate("availability", async () => {
    if (!next && activeOrders.length) throw new Error("Finaliza tus entregas antes de cerrar el turno.");
    let position: LocationObject | undefined;
    if (next) {
      try { position = await location.locate(); }
      catch (err) { setActionError(locationMessage(err)); throw err; }
    }
    const result = await run((token) => updateRiderAvailability(token, {
      isAvailable: next,
      latitude: position?.coords.latitude, longitude: position?.coords.longitude,
      accuracyMeters: position?.coords.accuracy,
    }));
    availableRef.current = result.available; setAvailable(result.available); setHidden([]);
    location.retry();
    await refreshSession().catch(() => null);
  }), [activeOrders.length, location, mutate, refreshSession, run]);

  const accept = useCallback((ride: RideOffer) => mutate(ride.key, async () => {
    const remaining = offerSeconds(ride.expiresAt);
    if (remaining === 0 || activeOrder) throw new Error("order-not-available");
    const result = await run((token) => ride.offerId ? acceptRiderOffer(token, ride.offerId) : acceptRiderOrder(token, ride.order.id));
    setData((current) => ({ ...current, mine: [result.order, ...current.mine.filter((order) => order.id !== result.order.id)] }));
  }), [activeOrder, mutate, run]);

  const reject = useCallback((ride: RideOffer) => mutate(ride.key, async () => {
    if (ride.offerId) await run((token) => rejectRiderOffer(token, ride.offerId!));
    else await run((token) => rejectRiderOrder(token, ride.order.id));
    setHidden((ids) => [...ids, ride.key]);
  }), [mutate, run]);

  const updateStatus = useCallback((order: MobileRiderOrder, status: "arrived" | "delivered", confirmationCode: string) => mutate("status", async () => {
    const result = await run((token) => updateRiderOrderStatus(token, order.id, status, confirmationCode));
    setData((current) => ({ ...current, mine: current.mine.map((item) => item.id === result.order.id ? result.order : item) }));
  }), [mutate, run]);

  const offers = useMemo<RideOffer[]>(() => {
    if (!available || activeOrder) return [];
    const directIds = new Set(data.offers.map((offer) => offer.orderId));
    return [
      ...data.offers.map((offer) => ({ key: offer.id, order: offer.order, offerId: offer.id, expiresAt: offer.expiresAt })),
      ...data.available.filter((order) => !directIds.has(order.id)).map((order) => ({ key: order.id, order })),
    ].filter((ride) => !hidden.includes(ride.key));
  }, [activeOrder, available, data, hidden]);

  return { activeOrder, activeOrders, offers, available, loaded, refreshing, error, actionError, pending, lastSync, location, refresh, toggleAvailability, accept, reject, updateStatus };
}

const DashboardContext = createContext<ReturnType<typeof useDashboardState> | null>(null);
export function RiderDashboardProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useRiderAuth();
  return <DashboardSession key={loading ? "restoring" : session?.user.id ?? "signed-out"}>{children}</DashboardSession>;
}
function DashboardSession({ children }: { children: ReactNode }) {
  const state = useDashboardState();
  return <DashboardContext.Provider value={state}>{children}</DashboardContext.Provider>;
}
export function useRiderDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("RiderDashboardProvider missing");
  return context;
}
