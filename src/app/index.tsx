/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { Check, MapPinned, Navigation, PackageCheck, X } from "lucide-react-native";
import { Animated, Linking, PanResponder, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/components/auth-gate";
import { LiveRiderMap } from "@/components/live-rider-map";
import { EmptyRidesState, MetricPill, PrimaryButton, RiderHeader, RiderScreen } from "@/components/rider-ui";
import { RiderAssets } from "@/constants/rider-assets";
import { RiderColors, RiderFonts } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { distanceKm, estimateEtaMinutes, formatDistance, googleDirectionsUrl, moneyBob, type Coordinates } from "@/lib/geo";
import {
  acceptRiderOrder,
  listRiderOrders,
  RiderApiError,
  riderErrorMessage,
  updateRiderLocation,
  updateRiderOrderStatus,
  type MobileRiderOrder,
} from "@/lib/rider-api";

const demoOrderId = "demo-rider-order";

export default function HomeScreen() {
  return (
    <AuthGate>
      <RiderHome />
    </AuthGate>
  );
}

function RiderHome() {
  const { refreshSession, session } = useRiderAuth();
  const [availableOrders, setAvailableOrders] = useState<MobileRiderOrder[]>([]);
  const [mineOrders, setMineOrders] = useState<MobileRiderOrder[]>([]);
  const [demoDispatchStatus, setDemoDispatchStatus] = useState<"available" | "active" | "arrived" | null>(__DEV__ ? "available" : null);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState("Ubicacion pendiente");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const token = session?.accessToken ?? "";

  const demoOrder = useMemo(() => createDemoOrder(), []);
  const demoActiveOrder = demoDispatchStatus === "active" || demoDispatchStatus === "arrived" ? withDemoDispatch(demoOrder, demoDispatchStatus) : null;
  const activeOrder = mineOrders.find((order) => order.dispatch?.status === "active" || order.dispatch?.status === "arrived") ?? demoActiveOrder;
  const activeOrderId = activeOrder?.id ?? "";
  const visibleAvailable = availableOrders.filter((order) => !rejectedIds.includes(order.id));
  const availableToShow = visibleAvailable.length ? visibleAvailable : demoDispatchStatus === "available" ? [demoOrder] : [];
  const showingDemoOrder = availableToShow.some((order) => isDemoOrderId(order.id));

  const runAuthorized = useCallback(
    async <T,>(operation: (accessToken: string) => Promise<T>) => {
      if (!token) throw new RiderApiError("unauthorized");

      try {
        return await operation(token);
      } catch (operationError) {
        if (!(operationError instanceof RiderApiError) || operationError.code !== "unauthorized") {
          throw operationError;
        }

        const refreshed = await refreshSession();
        const refreshedToken = refreshed?.accessToken;
        if (!refreshedToken || refreshedToken === token) {
          throw operationError;
        }

        return operation(refreshedToken);
      }
    },
    [refreshSession, token],
  );

  const loadOrders = useCallback(async () => {
    if (!token) return;
    const [available, mine] = await runAuthorized((accessToken) =>
      Promise.all([
        listRiderOrders(accessToken, "available"),
        listRiderOrders(accessToken, "mine"),
      ]),
    );
    setAvailableOrders(available.orders);
    setMineOrders(mine.orders);
  }, [runAuthorized, token]);

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

          if (isDemoOrderId(activeOrderId)) {
            setLocationStatus("Demo local");
            return;
          }

          void runAuthorized((accessToken) =>
            updateRiderLocation(accessToken, activeOrderId, {
              ...nextLocation,
              accuracyMeters: position.coords.accuracy,
              heading: position.coords.heading,
              speedMetersPerSecond: position.coords.speed,
            }),
          ).catch(() => {
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
  }, [activeOrderId, runAuthorized, token]);

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
      if (isDemoOrderId(order.id)) {
        setDemoDispatchStatus("active");
        return;
      }

      try {
        const result = await runAuthorized((accessToken) => acceptRiderOrder(accessToken, order.id));
        setMineOrders((orders) => [result.order, ...orders.filter((item) => item.id !== result.order.id)]);
        setAvailableOrders((orders) => orders.filter((item) => item.id !== result.order.id));
      } catch (acceptError) {
        setError(riderErrorMessage(acceptError));
        await loadOrders().catch(() => null);
      }
    },
    [loadOrders, runAuthorized, token],
  );

  const updateStatus = useCallback(
    async (order: MobileRiderOrder, status: "arrived" | "delivered") => {
      if (!token) return;
      setError("");
      if (isDemoOrderId(order.id)) {
        setDemoDispatchStatus(status === "delivered" ? null : status);
        return;
      }

      try {
        const result = await runAuthorized((accessToken) => updateRiderOrderStatus(accessToken, order.id, status));
        setMineOrders((orders) => {
          const next = orders.filter((item) => item.id !== result.order.id);
          return status === "delivered" ? next : [result.order, ...next];
        });
      } catch (statusError) {
        setError(riderErrorMessage(statusError));
      }
    },
    [runAuthorized, token],
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
              <View style={styles.availablePanel}>
                <View style={styles.availableCopy}>
                  <Text style={styles.availableEyebrow}>{showingDemoOrder ? "Vista demo" : "Turno activo"}</Text>
                  <Text style={styles.availableTitle}>{availableToShow.length ? "Carreras esperando rider" : "Esperando nuevas carreras"}</Text>
                  <Text style={styles.availableText}>
                    {showingDemoOrder ? "Pedido local para revisar el diseno" : `${availableToShow.length} solicitudes disponibles ahora`}
                  </Text>
                </View>
                <Image source={RiderAssets.illustrations.helmet} style={styles.availableImage} contentFit="contain" />
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{availableToShow.length}</Text>
                </View>
              </View>

              {availableToShow.length ? (
                availableToShow.map((order) => (
                  <OrderCard
                    currentLocation={currentLocation}
                    key={order.id}
                    onAccept={() => acceptOrder(order)}
                    onReject={() => {
                      if (isDemoOrderId(order.id)) {
                        setDemoDispatchStatus(null);
                        return;
                      }

                      setRejectedIds((ids) => [...ids, order.id]);
                    }}
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
      <View style={styles.jobHeader}>
        <View style={styles.jobHeaderCopy}>
          <Text style={styles.jobEyebrow}>Nueva carrera</Text>
          <Text style={styles.jobNumber}>Pedido {order.orderNumber}</Text>
          <Text style={styles.restaurant}>{order.restaurant.name}</Text>
        </View>
        <View style={styles.feeBadge}>
          <Text style={styles.feeLabel}>Ganancia</Text>
          <Text style={styles.feeValue}>{moneyBob(order.deliveryFee)}</Text>
        </View>
      </View>

      <View style={styles.cardMap}>
        <LiveRiderMap currentLocation={currentLocation} destination={destination} />
        <View style={styles.mapBadge}>
          <MapPinned color={RiderColors.ink} size={16} strokeWidth={2.5} />
          <Text style={styles.mapBadgeText}>{formatDistance(kilometers)}</Text>
        </View>
      </View>

      <View style={styles.routeBlock}>
        <RoutePoint color={RiderColors.orange} label="Recoger" title={order.restaurant.name} text={order.restaurant.city || "Restaurante asignado"} />
        <View style={styles.routeDivider} />
        <RoutePoint
          color="#1267EA"
          label="Entregar"
          title={order.customerAddress || "Direccion sin detalle"}
          text={order.deliveryAddressDetail || order.customerName}
        />
      </View>

      <View style={styles.metricsRow}>
        <MetricPill label="Distancia" value={formatDistance(kilometers)} />
        <MetricPill label="Ganancia" value={moneyBob(order.deliveryFee)} tone="lime" />
        <MetricPill label="Tiempo est." value={estimateEtaMinutes(kilometers)} />
      </View>
      <View style={styles.swipeRow}>
        <PrimaryButton onPress={onReject} tone="red">
          <X color={RiderColors.white} size={22} strokeWidth={3} />
        </PrimaryButton>
        <View style={styles.swipeCopy}>
          <Text style={styles.swipeTitle}>Tomar esta carrera</Text>
          <Text style={styles.swipeHint}>Desliza o toca aceptar</Text>
        </View>
        <PrimaryButton onPress={() => void onAccept()}>
          <Check color={RiderColors.ink} size={23} strokeWidth={3} />
        </PrimaryButton>
      </View>
    </Animated.View>
  );
}

function RoutePoint({ color, label, text, title }: { color: string; label: string; text: string; title: string }) {
  return (
    <View style={styles.routePoint}>
      <View style={[styles.routeDot, { backgroundColor: color }]} />
      <View style={styles.routeCopy}>
        <Text style={[styles.routeLabel, { color }]}>{label}</Text>
        <Text style={styles.routeTitle}>{title}</Text>
        <Text style={styles.routeText}>{text}</Text>
      </View>
    </View>
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
            <View style={styles.actionContent}>
              <Navigation color={RiderColors.white} size={18} strokeWidth={2.7} />
              <Text style={styles.actionWhite}>Abrir Maps</Text>
            </View>
          </PrimaryButton>
          <PrimaryButton onPress={() => onUpdateStatus(arrived ? "delivered" : "arrived")}>
            <View style={styles.actionContent}>
              <PackageCheck color={RiderColors.ink} size={18} strokeWidth={2.7} />
              <Text style={styles.actionLime}>{arrived ? "Entregado" : "Llegue"}</Text>
            </View>
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

function isDemoOrderId(orderId: string) {
  return orderId === demoOrderId;
}

function createDemoOrder(): MobileRiderOrder {
  const now = new Date().toISOString();

  return {
    id: demoOrderId,
    restaurant: {
      id: "demo-restaurant",
      name: "Pizzeria Italia",
      slug: "pizzeria-italia",
      city: "Calancha, Cochabamba",
      logoUrl: "",
      whatsapp: "70000000",
    },
    orderNumber: "D-1048",
    customerName: "Cliente demo",
    customerPhone: "70012345",
    customerAddress: "Av. America y Pando",
    deliveryAddressDetail: "Edificio Alameda, porteria principal",
    deliveryLatitude: -17.3716,
    deliveryLongitude: -66.1583,
    deliveryMapsUrl: "",
    requestedFulfillmentAt: null,
    status: "ready",
    paymentStatus: "paid",
    paymentMethod: "qr",
    subtotal: 92,
    deliveryFee: 18,
    discountTotal: 0,
    total: 110,
    notes: "Llamar al llegar. El cliente baja a recibir.",
    acceptedAt: null,
    preparingAt: now,
    readyAt: now,
    deliveredAt: null,
    cancelledAt: null,
    cancellationReason: "",
    createdAt: now,
    dispatch: {
      id: "demo-dispatch",
      riderId: null,
      status: "active",
      deliveryPhone: "70012345",
      deliveryName: "Cliente demo",
      openedAt: null,
      arrivedAt: null,
      deliveredAt: null,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      createdAt: now,
      riderLocation: null,
    },
    items: [
      {
        id: "demo-item-1",
        productId: "demo-product-1",
        productName: "Pizza mediana especial",
        unitPrice: 72,
        quantity: 1,
        subtotal: 72,
        notes: "Sin cebolla",
      },
      {
        id: "demo-item-2",
        productId: "demo-product-2",
        productName: "Refresco 2L",
        unitPrice: 20,
        quantity: 1,
        subtotal: 20,
        notes: "",
      },
    ],
  };
}

function withDemoDispatch(order: MobileRiderOrder, status: "active" | "arrived"): MobileRiderOrder {
  const now = new Date().toISOString();

  return {
    ...order,
    acceptedAt: order.acceptedAt ?? now,
    dispatch: {
      ...(order.dispatch ?? createDemoOrder().dispatch!),
      riderId: "demo-rider",
      status,
      openedAt: order.dispatch?.openedAt ?? now,
      arrivedAt: status === "arrived" ? order.dispatch?.arrivedAt ?? now : order.dispatch?.arrivedAt ?? null,
    },
  };
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
    gap: 14,
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
  availablePanel: {
    alignItems: "center",
    backgroundColor: RiderColors.card,
    borderRadius: 22,
    elevation: 10,
    flexDirection: "row",
    minHeight: 116,
    overflow: "hidden",
    paddingLeft: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  availableCopy: {
    flex: 1,
    gap: 4,
    paddingVertical: 18,
  },
  availableEyebrow: {
    color: RiderColors.limeDark,
    fontFamily: RiderFonts.black,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  availableTitle: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 19,
    fontWeight: "900",
  },
  availableText: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: "700",
  },
  availableImage: {
    height: 92,
    marginRight: 10,
    width: 82,
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: RiderColors.lime,
    borderBottomLeftRadius: 18,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 48,
  },
  countText: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 18,
    fontWeight: "900",
  },
  jobCard: {
    backgroundColor: RiderColors.card,
    borderRadius: 22,
    elevation: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  jobHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 12,
  },
  jobHeaderCopy: {
    flex: 1,
  },
  jobEyebrow: {
    color: RiderColors.orange,
    fontFamily: RiderFonts.black,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  jobNumber: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },
  feeBadge: {
    alignItems: "flex-end",
    backgroundColor: RiderColors.blue950,
    borderRadius: 18,
    minWidth: 104,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feeLabel: {
    color: RiderColors.white,
    fontFamily: RiderFonts.bold,
    fontSize: 10,
    fontWeight: "800",
    opacity: 0.72,
    textTransform: "uppercase",
  },
  feeValue: {
    color: RiderColors.lime,
    fontFamily: RiderFonts.black,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  cardMap: {
    height: 190,
    marginHorizontal: 16,
    overflow: "hidden",
    borderRadius: 18,
  },
  restaurant: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.extraBold,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },
  address: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.semibold,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  mapBadge: {
    alignItems: "center",
    backgroundColor: RiderColors.lime,
    borderRadius: 17,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 11,
    position: "absolute",
    right: 12,
    top: 12,
  },
  mapBadgeText: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 12,
    fontWeight: "900",
  },
  routeBlock: {
    gap: 0,
    padding: 16,
    paddingBottom: 12,
  },
  routePoint: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 11,
  },
  routeDot: {
    borderRadius: 9,
    height: 12,
    marginTop: 5,
    width: 12,
  },
  routeCopy: {
    flex: 1,
  },
  routeLabel: {
    fontFamily: RiderFonts.black,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeTitle: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },
  routeText: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },
  routeDivider: {
    backgroundColor: RiderColors.line,
    height: 18,
    marginLeft: 5.5,
    width: 1,
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
    minHeight: 82,
    paddingHorizontal: 16,
  },
  swipeCopy: {
    flex: 1,
  },
  swipeTitle: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  swipeHint: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
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
  actionContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
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
