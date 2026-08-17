import { useEffect } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RiderScreen } from "@/components/rider-ui";
import { RiderColors } from "@/constants/rider-theme";

export default function AuthCallbackScreen() {
  useEffect(() => {
    const timeout = setTimeout(() => router.replace("/"), 250);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <RiderScreen>
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={RiderColors.lime} size="large" />
        <Text style={styles.text}>Volviendo a la app...</Text>
      </SafeAreaView>
    </RiderScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  text: {
    color: RiderColors.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
