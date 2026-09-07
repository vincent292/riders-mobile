import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { useAuthorized } from "./use-authorized";
import { listRiderOrders, riderErrorMessage, type MobileRiderOrder } from "@/lib/rider-api";
import { subscribeToRiderOrderChanges } from "@/lib/rider-events";

export function useRiderHistory() {
  const run = useAuthorized();
  const [orders, setOrders] = useState<MobileRiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await run((token) => listRiderOrders(token, "history"));
      if (id === requestId.current) { setOrders(result.orders); setError(""); setLoaded(true); }
    } catch (err) { if (id === requestId.current) setError(riderErrorMessage(err)); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [run]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const unsubscribe = subscribeToRiderOrderChanges(() => { void refresh(); });
    const state = AppState.addEventListener("change", (next) => { if (next === "active") void refresh(); });
    return () => { requestId.current++; unsubscribe(); state.remove(); };
  }, [refresh]));
  return { orders, loading, loaded, error, refresh };
}
