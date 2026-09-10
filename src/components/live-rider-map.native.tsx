import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LocateFixed } from "lucide-react-native";

import { RiderColors } from "@/constants/rider-theme";
import type { Coordinates } from "@/lib/geo";

const brandedMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#F3F6F4" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#606B65" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#DFE5E0" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#EEF3EF" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#E8EFEA" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#DCEBDD" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#426500" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#DFE5E0" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#FEFBF3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#DDEAC1" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#C7F000" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#7B8580" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#CBE8E5" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#117B70" }] },
];

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
        customMapStyle={brandedMapStyle}
        showsBuildings={false}
        showsCompass={false}
        moveOnMarkerPress={false}
        initialRegion={region}
        style={styles.map}
        toolbarEnabled={false}
        userInterfaceStyle="light">
        {currentLocation ? (
          <Marker coordinate={currentLocation} title="Tu ubicacion" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.riderMarker}>
              <View style={styles.riderDot} />
            </View>
          </Marker>
        ) : null}
        {destination ? (
          <Marker coordinate={destination} title="Entrega" anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.destinationMarker}>
              <View style={styles.destinationPin}>
                <View style={styles.destinationDot} />
              </View>
              <View style={styles.destinationStem} />
            </View>
          </Marker>
        ) : null}
        {points.length > 1 ? <Polyline coordinates={points} strokeColor={RiderColors.teal} strokeWidth={2} lineDashPattern={[5, 7]} /> : null}
      </MapView>
      {loadSlow && !loaded ? <View style={styles.notice}><Text style={styles.noticeText}>El mapa esta tardando en cargar. Puedes abrir la ruta al cliente.</Text></View> : null}
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
  riderMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(17,123,112,0.22)", borderWidth: 2, borderColor: RiderColors.white, alignItems: "center", justifyContent: "center" },
  riderDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: RiderColors.teal },
  destinationMarker: { alignItems: "center" },
  destinationPin: { width: 34, height: 34, borderRadius: 17, backgroundColor: RiderColors.lime, borderWidth: 3, borderColor: RiderColors.ink, alignItems: "center", justifyContent: "center" },
  destinationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RiderColors.ink },
  destinationStem: { width: 3, height: 12, backgroundColor: RiderColors.ink, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: -2 },
  notice: { position: "absolute", top: 12, left: 12, right: 12, backgroundColor: RiderColors.white, borderRadius: 8, padding: 12 },
  noticeText: { color: RiderColors.ink, fontSize: 13, lineHeight: 19 },
  recenter: { position: "absolute", right: 12, bottom: 12, backgroundColor: RiderColors.white, borderRadius: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center", elevation: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: RiderColors.soft },
  emptyText: { color: RiderColors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 18 },
});
