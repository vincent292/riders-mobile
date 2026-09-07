import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  const [following, setFollowing] = useState(true);
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
    if (!ready || !points.length) return;
    if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 45, right: 55, bottom: 50, left: 45 }, animated: true });
    else map.current?.animateToRegion(region, 350);
  }, [points, ready, region]);
  useEffect(() => { if (following) fit(); }, [fit, following]);

  if (!currentLocation && !destination) return <View style={styles.empty}><LocateFixed size={28} color={RiderColors.muted} /><Text style={styles.emptyText}>Ubicación pendiente</Text></View>;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={map}
        onMapReady={() => setReady(true)}
        onPanDrag={() => setFollowing(false)}
        loadingBackgroundColor={RiderColors.soft}
        loadingEnabled
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
    flex: 1,
  },
  recenter: { position: "absolute", right: 12, bottom: 12, backgroundColor: RiderColors.white, borderRadius: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center", elevation: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: RiderColors.soft },
  emptyText: { color: RiderColors.muted, fontSize: 13 },
});
