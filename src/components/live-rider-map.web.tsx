import { StyleSheet, Text, View } from "react-native";

import { RiderColors } from "@/constants/rider-theme";
import type { Coordinates } from "@/lib/geo";

export function LiveRiderMap({
  destination,
}: {
  currentLocation?: Coordinates | null;
  destination?: Coordinates | null;
}) {
  return (
    <View style={styles.map}>
      <Text style={styles.title}>Mapa de entrega</Text>
      <Text style={styles.text}>
        {destination
          ? `${destination.latitude.toFixed(5)}, ${destination.longitude.toFixed(5)}`
          : "Este pedido no tiene coordenadas guardadas."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
