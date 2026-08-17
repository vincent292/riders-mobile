import { useMemo } from "react";
import MapView, { Marker, Polyline } from "react-native-maps";
import { StyleSheet, View } from "react-native";

import { RiderColors } from "@/constants/rider-theme";
import type { Coordinates } from "@/lib/geo";

export function LiveRiderMap({
  currentLocation,
  destination,
}: {
  currentLocation?: Coordinates | null;
  destination?: Coordinates | null;
}) {
  const fallback = destination ?? currentLocation ?? { latitude: -17.3895, longitude: -66.1568 };
  const points = [currentLocation, destination].filter(Boolean) as Coordinates[];
  const region = useMemo(
    () => ({
      latitude: fallback.latitude,
      latitudeDelta: 0.035,
      longitude: fallback.longitude,
      longitudeDelta: 0.035,
    }),
    [fallback.latitude, fallback.longitude],
  );

  return (
    <View style={styles.wrap}>
      <MapView
        loadingBackgroundColor={RiderColors.soft}
        loadingEnabled
        loadingIndicatorColor={RiderColors.limeDark}
        mapType="standard"
        moveOnMarkerPress={false}
        region={region}
        style={styles.map}
        toolbarEnabled={false}
        userInterfaceStyle="light">
        {currentLocation ? (
          <Marker coordinate={currentLocation} title="Tu ubicacion" pinColor={RiderColors.limeDark} />
        ) : null}
        {destination ? (
          <Marker coordinate={destination} title="Entrega" pinColor={RiderColors.red} />
        ) : null}
        {points.length > 1 ? <Polyline coordinates={points} strokeColor="#1267EA" strokeWidth={4} /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 220,
    overflow: "hidden",
    backgroundColor: RiderColors.soft,
  },
  map: {
    flex: 1,
    minHeight: 220,
  },
});
