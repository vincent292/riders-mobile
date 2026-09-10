import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LocateFixed } from "lucide-react-native";

import { RiderColors } from "@/constants/rider-theme";
import type { Coordinates } from "@/lib/geo";

export function LiveRiderMap({
  currentLocation,
  destination,
}: {
  currentLocation?: Coordinates | null;
  destination?: Coordinates | null;
}) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadSlow, setLoadSlow] = useState(false);
  const [following, setFollowing] = useState(true);
  const hasPoints = Boolean(currentLocation || destination);
  const fallback = destination ?? currentLocation ?? { latitude: -17.3895, longitude: -66.1568 };
  const points = useMemo(() => [currentLocation, destination].filter(Boolean) as Coordinates[], [currentLocation, destination]);
  const region = useMemo(
    () => ({
      latitude: fallback.latitude,
      latitudeDelta: 0.035,
      longitude: fallback.longitude,
      longitudeDelta: 0.035,
    }),
    [fallback.latitude, fallback.longitude],
  );
  const fit = useCallback(() => {
    if (!ready || !laidOut || !points.length) return;
    if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 45, right: 55, bottom: 50, left: 45 }, animated: true });
    else map.current?.animateToRegion(region, 350);
  }, [laidOut, points, ready, region]);
  useEffect(() => { if (following) fit(); }, [fit, following]);
  useEffect(() => {
    if (Platform.OS !== "android" || !hasPoints || loaded) return;
    const timeout = setTimeout(() => setLoadSlow(true), 12000);
    return () => clearTimeout(timeout);
  }, [hasPoints, loaded]);

  if (!hasPoints) return <View style={styles.empty}><LocateFixed size={28} color={RiderColors.muted} /><Text style={styles.emptyText}>Este pedido no tiene un punto de entrega guardado.</Text></View>;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        onLayout={() => setLaidOut(true)}
        onMapReady={() => setReady(true)}
        onMapLoaded={() => { setLoaded(true); setLoadSlow(false); }}
        onPanDrag={() => setFollowing(false)}
        loadingBackgroundColor={RiderColors.soft}
        loadingIndicatorColor={RiderColors.limeDark}
        mapType="standard"
        moveOnMarkerPress={false}
        initialRegion={region}
        style={styles.map}
        toolbarEnabled={false}
        userInterfaceStyle="light">
        {currentLocation ? (
          <Marker coordinate={currentLocation} title="Tu ubicación" pinColor={RiderColors.teal} />
        ) : null}
        {destination ? (
          <Marker coordinate={destination} title="Entrega" pinColor={RiderColors.red} />
        ) : null}
        {points.length > 1 ? <Polyline coordinates={points} strokeColor={RiderColors.teal} strokeWidth={2} lineDashPattern={[5, 7]} /> : null}
      </MapView>
      {loadSlow && !loaded ? <View style={styles.notice}><Text style={styles.noticeText}>El mapa está tardando en cargar. Puedes abrir la ruta al cliente.</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Centrar mapa" onPress={() => { setFollowing(true); fit(); }} style={styles.recenter}><LocateFixed size={21} color={RiderColors.ink} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: RiderColors.soft,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  notice: { position: "absolute", top: 12, left: 12, right: 12, backgroundColor: RiderColors.white, borderRadius: 8, padding: 12 },
  noticeText: { color: RiderColors.ink, fontSize: 13, lineHeight: 19 },
  recenter: { position: "absolute", right: 12, bottom: 12, backgroundColor: RiderColors.white, borderRadius: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center", elevation: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: RiderColors.soft },
  emptyText: { color: RiderColors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 18 },
});
