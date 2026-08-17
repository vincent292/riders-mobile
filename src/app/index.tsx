/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";
import { Animated, Linking, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/components/auth-gate";
import { LiveRiderMap } from "@/components/live-rider-map";
import { EmptyRidesState, MetricPill, PrimaryButton, RiderHeader, RiderScreen, SectionLabel } from "@/components/rider-ui";
import { RiderColors, RiderFonts } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { distanceKm, estimateEtaMinutes, formatDistance, googleDirectionsUrl, moneyBob, type Coordinates } from "@/lib/geo";
import {
  acceptRiderOrder,
  listRiderOrders,
  riderErrorMessage,
  updateRiderLocation,
  updateRiderOrderStatus,
  type MobileRiderOrder,
} from "@/lib/rider-api";

export default function HomeScreen() {
  return (
    <AuthGate>
      <RiderHome />
    </AuthGate>
  );
}

function RiderHome() {
  const { session } = useRiderAuth();
  const [availableOrders, setAvailableOrders] = useState<MobileRiderOrder[]>([]);
  const [mineOrders, setMineOrders] = useState<MobileRiderOrder[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState("Ubicacion pendiente");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const token = session?.accessToken ?? "";

  const activeOrder = mineOrders.find((order) => order.dispatch?.status === "active" || order.dispatch?.status === "arrived") ?? null;
  const activeOrderId = activeOrder?.id ?? "";
  const visibleAvailable = availableOrders.filter((order) => !rejectedIds.includes(order.id));

  const loadOrders = useCallback(async () => {
    if (!token) return;
    const [available, mine] = await Promise.all([
      listRiderOrders(token, "available"),
      listRiderOrders(token, "mine"),
    ]);
    setAvailableOrders(available.orders);
    setMineOrders(mine.orders);
  }, [token]);

  useEffect(() => {
    let mounted = true;

    async function loadLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;

      if (permission.status !== "granted") {
        setLocationStatus("Sin permiso de ubicacion");
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!mounted) return;
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationStatus("En linea");
    }

    void loadLocation().catch(() => setLocationStatus("Ubicacion no disponible"));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !activeOrderId) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    let lastSentAt = 0;

    async function startLiveLocation() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled || permission.status !== "granted") {
        setLocationStatus("Sin permiso de ubicacion");
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 12,
          mayShowUserSettingsDialog: true,
          timeInterval: 7000,
        },
        (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCurrentLocation(nextLocation);
          setLocationStatus("Compartiendo ubicacion");

          const now = Date.now();
          if (now - lastSentAt < 6000) return;
          lastSentAt = now;

          void updateRiderLocation(token, activeOrderId, {
            ...nextLocation,
            accuracyMeters: position.coords.accuracy,
            heading: position.coords.heading,
            speedMetersPerSecond: position.coords.speed,
          }).catch(() => {
            setLocationStatus("Ubicacion local");
          });
        },
      );
    }

    void startLiveLocation().catch(() => setLocationStatus("Ubicacion no disponible"));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [activeOrderId, token]);

  useEffect(() => {
    if (!token) return;

    void loadOrders().catch((loadError) => setError(riderErrorMessage(loadError)));
    const interval = setInterval(() => {
      void loadOrders().catch(() => null);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadOrders, token]);

  const refresh = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      await loadOrders();
    } catch (refreshError) {
      setError(riderErrorMessage(refreshError));
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders]);

  const acceptOrder = useCallback(
    async (order: MobileRiderOrder) => {
      if (!token) return;
      setError("");
      try {
        const result = await acceptRiderOrder(token, order.id);
        setMineOrders((orders) => [result.order, ...orders.filter((item) => item.id !== result.order.id)]);
        setAvailableOrders((orders) => orders.filter((item) => item.id !== result.order.id));
      } catch (acceptError) {
        setError(riderErrorMessage(acceptError));
        await loadOrders().catch(() => null);
      }
    },
    [loadOrders, token],
  );

  const updateStatus = useCallback(
    async (order: MobileRiderOrder, status: "arrived" | "delivered") => {
      if (!token) return;
      setError("");
      try {
        const result = await updateRiderOrderStatus(token, order.id, status);
        setMineOrders((orders) => {
          const next = orders.filter((item) => item.id !== result.order.id);
          return status === "delivered" ? next : [result.order, ...next];
        });
      } catch (statusError) {
        setError(riderErrorMessage(statusError));
      }
    },
    [token],
  );

  return (
    <RiderScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <RiderHeader title={activeOrder ? "Entrega activa" : "Carrera asignada"} subtitle={locationStatus} />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={RiderColors.lime} />}
          showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {activeOrder ? (
            <ActiveRouteCard
              currentLocation={currentLocation}
              onOpenMaps={() => openOrderMaps(activeOrder, currentLocation)}
              onUpdateStatus={(status) => updateStatus(activeOrder, status)}
              order={activeOrder}
            />
          ) : (
            <>
              <View style={styles.availableRow}>
                <Text style={styles.availableText}>Tienes</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{visibleAvailable.length}</Text>
                </View>
                <Text style={styles.availableText}>carreras disponibles</Text>
              </View>

              {visibleAvailable.length ? (
                visibleAvailable.map((order) => (
                  <OrderCard
                    currentLocation={currentLocation}
                    key={order.id}
                    onAccept={() => acceptOrder(order)}
                    onReject={() => setRejectedIds((ids) => [...ids, order.id])}
                    order={order}
                  />
                ))
              ) : (
                <EmptyRidesState text="Te avisaremos cuando caja marque un pedido delivery como listo." />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </RiderScreen>
  );
}

function OrderCard({
  currentLocation,
  onAccept,
  onReject,
  order,
}: {
  currentLocation: Coordinates | null;
  onAccept: () => Promise<void>;
  onReject: () => void;
  order: MobileRiderOrder;
}) {
  const [pan] = useState(() => new Animated.Value(0));
  const destination = orderDestination(order);
  const kilometers = distanceKm(currentLocation, destination);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 14,
        onPanResponderMove: Animated.event([null, { dx: pan }], { useNativeDriver: false }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 92) void onAccept();
          if (gesture.dx < -92) onReject();
          Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [onAccept, onReject, pan],
  );

  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.jobCard, { transform: [{ translateX: pan }] }]}>
      <View style={styles.cardMap}>
        <LiveRiderMap currentLocation={currentLocation} destination={destination} />
      </View>
      <View style={styles.jobBody}>
        <SectionLabel>
          <Text style={styles.pickupLabel}>Recoger en</Text>
        </SectionLabel>
        <Text style={styles.restaurant}>{order.restaurant.name}</Text>
        <Text style={styles.address}>{order.restaurant.city || "Restaurante asignado"}</Text>
        <Text style={styles.dropLabel}>Entregar en</Text>
        <Text style={styles.dropoff}>{order.customerAddress || "Direccion sin detalle"}</Text>
        <Text style={styles.address}>{order.deliveryAddressDetail || order.customerName}</Text>
      </View>
      <View style={styles.metricsRow}>
        <MetricPill label="Distancia" value={formatDistance(kilometers)} />
        <MetricPill label="Ganancia" value={moneyBob(order.deliveryFee)} tone="lime" />
        <MetricPill label="Tiempo est." value={estimateEtaMinutes(kilometers)} />
      </View>
      <View style={styles.swipeRow}>
        <PrimaryButton onPress={onReject} tone="red">
          <Text style={styles.arrowText}>{"<"}</Text>
        </PrimaryButton>
        <Text style={styles.swipeHint}>Desliza derecha para aceptar, izquierda para rechazar</Text>
        <PrimaryButton onPress={() => void onAccept()}>
          <Text style={styles.arrowTextDark}>{">"}</Text>
        </PrimaryButton>
      </View>
    </Animated.View>
  );
}

function ActiveRouteCard({
  currentLocation,
  onOpenMaps,
  onUpdateStatus,
  order,
}: {
  currentLocation: Coordinates | null;
  onOpenMaps: () => void;
  onUpdateStatus: (status: "arrived" | "delivered") => void;
  order: MobileRiderOrder;
}) {
  const destination = orderDestination(order);
  const kilometers = distanceKm(currentLocation, destination);
  const arrived = order.dispatch?.status === "arrived";

  return (
    <View style={styles.activeWrap}>
      <View style={styles.mapHero}>
        <LiveRiderMap currentLocation={currentLocation} destination={destination} />
        <View style={styles.locationBubble}>
          <Text style={styles.locationTitle}>Ruta en curso</Text>
          <Text style={styles.locationText}>{formatDistance(kilometers)} hacia el cliente</Text>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusTop}>
          <View style={styles.statusTitleWrap}>
            <Text style={styles.statusEyebrow}>Pedido {order.orderNumber}</Text>
            <Text style={styles.statusTitle}>Recoge en {order.restaurant.name}</Text>
          </View>
          <View style={styles.readyPill}>
            <Text style={styles.readyText}>{order.status === "ready" ? "Listo" : order.status}</Text>
          </View>
        </View>

        <View style={styles.timeline}>
          <TimelineStep active label="Aceptado" />
          <TimelineStep active={order.status === "ready"} label="Listo" />
          <TimelineStep active={arrived} label="Llegue" />
          <TimelineStep label="Entregado" />
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Datos del cliente</Text>
          <Text style={styles.clientName}>{order.customerName}</Text>
          <Text style={styles.address}>{order.customerPhone || "Sin telefono"}</Text>
          <Text style={styles.address}>{order.customerAddress}</Text>
          {order.notes ? <Text style={styles.notes}>{order.notes}</Text> : null}
        </View>

        <View style={styles.pickupNumber}>
          <Text style={styles.pickupNumberLabel}>Numero para recoger</Text>
          <Text style={styles.pickupNumberValue}>{order.orderNumber}</Text>
        </View>

        <View style={styles.actionGrid}>
          <PrimaryButton onPress={onOpenMaps} tone="dark">
            <Text style={styles.actionWhite}>Abrir Maps</Text>
          </PrimaryButton>
          <PrimaryButton onPress={() => onUpdateStatus(arrived ? "delivered" : "arrived")}>
            <Text style={styles.actionLime}>{arrived ? "Entregado" : "Llegue"}</Text>
          </PrimaryButton>
        </View>
      </View>
    </View>
  );
}

function TimelineStep({ active, label }: { active?: boolean; label: string }) {
  return (
    <View style={styles.timelineStep}>
      <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
      <Text style={[styles.timelineText, active && styles.timelineTextActive]}>{label}</Text>
    </View>
  );
}

function orderDestination(order: MobileRiderOrder): Coordinates | null {
  if (order.deliveryLatitude == null || order.deliveryLongitude == null) return null;
  return {
    latitude: order.deliveryLatitude,
    longitude: order.deliveryLongitude,
  };
}

function openOrderMaps(order: MobileRiderOrder, currentLocation: Coordinates | null) {
  const destination = orderDestination(order);
  const url = order.deliveryMapsUrl || (destination ? googleDirectionsUrl(destination, currentLocation) : googleDirectionsUrl(order.customerAddress));
  void Linking.openURL(url);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 112,
    paddingHorizontal: 18,
  },
  error: {
    borderRadius: 18,
    backgroundColor: "rgba(255,59,48,0.12)",
    color: RiderColors.white,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    padding: 14,
  },
  availableRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  availableText: {
    color: RiderColors.white,
    fontFamily: RiderFonts.bold,
    fontSize: 14,
    fontWeight: "700",
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: RiderColors.lime,
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    minWidth: 24,
  },
  countText: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontWeight: "900",
  },
  jobCard: {
    backgroundColor: RiderColors.card,
    borderRadius: 24,
    elevation: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  cardMap: {
    minHeight: 220,
  },
  jobBody: {
    padding: 16,
  },
  pickupLabel: {
    color: RiderColors.orange,
  },
  restaurant: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },
  address: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.semibold,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  dropLabel: {
    color: "#1267EA",
    fontFamily: RiderFonts.black,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 14,
    textTransform: "uppercase",
  },
  dropoff: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 5,
  },
  metricsRow: {
    borderBottomWidth: 1,
    borderColor: RiderColors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 68,
  },
  swipeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 16,
  },
  swipeHint: {
    color: RiderColors.muted,
    flex: 1,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  arrowText: {
    color: "#fff",
    fontFamily: RiderFonts.black,
    fontSize: 28,
    fontWeight: "900",
  },
  arrowTextDark: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 28,
    fontWeight: "900",
  },
  activeWrap: {
    gap: 16,
  },
  mapHero: {
    backgroundColor: RiderColors.soft,
    borderRadius: 28,
    minHeight: 300,
    overflow: "hidden",
  },
  locationBubble: {
    alignItems: "center",
    backgroundColor: RiderColors.blue950,
    borderRadius: 22,
    bottom: 22,
    justifyContent: "center",
    left: 26,
    minHeight: 64,
    position: "absolute",
    right: 26,
  },
  locationTitle: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
  locationText: {
    color: RiderColors.lime,
    fontFamily: RiderFonts.extraBold,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  statusCard: {
    backgroundColor: RiderColors.card,
    borderRadius: 28,
    gap: 18,
    padding: 18,
  },
  statusTop: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  statusTitleWrap: {
    flex: 1,
  },
  statusEyebrow: {
    color: RiderColors.orange,
    fontFamily: RiderFonts.black,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusTitle: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 4,
  },
  readyPill: {
    alignItems: "center",
    backgroundColor: RiderColors.lime,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    minWidth: 70,
    paddingHorizontal: 10,
  },
  readyText: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 13,
    fontWeight: "900",
  },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineStep: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  timelineDot: {
    backgroundColor: "#CCD4DE",
    borderRadius: 13,
    height: 13,
    width: 13,
  },
  timelineDotActive: {
    backgroundColor: RiderColors.lime,
  },
  timelineText: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.extraBold,
    fontSize: 11,
    fontWeight: "800",
  },
  timelineTextActive: {
    color: RiderColors.ink,
  },
  infoBlock: {
    backgroundColor: RiderColors.soft,
    borderRadius: 18,
    padding: 14,
  },
  infoLabel: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.black,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  clientName: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  notes: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 8,
  },
  pickupNumber: {
    backgroundColor: RiderColors.blue900,
    borderRadius: 20,
    padding: 16,
  },
  pickupNumberLabel: {
    color: RiderColors.white,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: "800",
  },
  pickupNumberValue: {
    color: RiderColors.lime,
    fontFamily: RiderFonts.black,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionLime: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 14,
    fontWeight: "900",
  },
  actionWhite: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 14,
    fontWeight: "900",
  },
});
