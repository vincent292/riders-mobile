import { StyleSheet, Text, View } from "react-native";

import { RiderColors } from "@/constants/rider-theme";
import type { Coordinates } from "@/lib/geo";

export function LiveRiderMap({
  currentLocation,
  destination,
}: {
  currentLocation?: Coordinates | null;
  destination?: Coordinates | null;
}) {
  // Keep the delivery pin stable while foreground GPS samples arrive.
  const point = destination ?? currentLocation;
  if (point) {
    const params = new URLSearchParams({
      bbox: [
        Math.max(-180, point.longitude - 0.012),
        Math.max(-90, point.latitude - 0.008),
        Math.min(180, point.longitude + 0.012),
        Math.min(90, point.latitude + 0.008),
      ].join(","),
      layer: "mapnik",
      marker: `${point.latitude},${point.longitude}`,
    });
    return <View style={styles.frame}>
      <iframe
        title={destination ? "Mapa del destino de entrega" : "Mapa de tu ubicación"}
        src={`https://www.openstreetmap.org/export/embed.html?${params.toString()}`}
        referrerPolicy="no-referrer"
        style={{ border: 0, width: "100%", height: "100%" }}
      />
    </View>;
  }
  return (
    <View style={styles.map}>
      <Text style={styles.title}>Mapa de entrega</Text>
      <Text style={styles.text}>
        Este pedido no tiene un punto de entrega guardado.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: RiderColors.soft },
  map: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RiderColors.soft,
    padding: 18,
  },
  title: {
    color: RiderColors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  text: {
    marginTop: 6,
    color: RiderColors.muted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
});
