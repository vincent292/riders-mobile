/* eslint-disable react-hooks/set-state-in-effect */
import { Image } from "expo-image";
import { BarChart3, CreditCard, Headphones, Mail, Phone, Store, UserCheck, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/components/auth-gate";
import { LogoMark, PrimaryButton, RiderHeader, RiderScreen } from "@/components/rider-ui";
import { RiderAssets } from "@/constants/rider-assets";
import { RiderColors, RiderFonts } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { moneyBob, shortDate } from "@/lib/geo";
import { listRiderOrders, RiderApiError, riderErrorMessage, type MobileRiderOrder } from "@/lib/rider-api";

export default function ProfileScreen() {
  return (
    <AuthGate>
      <ProfileContent />
    </AuthGate>
  );
}

function ProfileContent() {
  const { refreshSession, session, signOut } = useRiderAuth();
  const [history, setHistory] = useState<MobileRiderOrder[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const activeRider = session?.activeRiders[0] ?? session?.riders[0] ?? null;
  const token = session?.accessToken ?? "";

  const delivered = history.filter((order) => order.dispatch?.status === "delivered" || order.status === "delivered");
  const earnings = delivered.reduce((sum, order) => sum + order.deliveryFee, 0);
  const activeRestaurants = useMemo(() => session?.riders.map((rider) => rider.restaurantName).join(", ") ?? "", [session?.riders]);

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

  const load = useCallback(async () => {
    if (!token) return;
    const result = await runAuthorized((accessToken) => listRiderOrders(accessToken, "history"));
    setHistory(result.orders);
  }, [runAuthorized, token]);

  useEffect(() => {
    void load().catch(() => null);
  }, [load]);

  const refresh = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      await Promise.all([refreshSession(), load()]);
    } catch (refreshError) {
      setError(riderErrorMessage(refreshError));
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshSession]);

  return (
    <RiderScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <RiderHeader title="Perfil" subtitle={activeRider?.status === "active" ? "Rider verificado" : "Cuenta inactiva"} />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={RiderColors.lime} />}
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <LogoMark />
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Image source={RiderAssets.illustrations.riderStanding} style={styles.avatar} contentFit="contain" />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.name}>{activeRider?.fullName ?? session?.user.email ?? "Rider"}</Text>
              <Text style={styles.rating}>{activeRider?.plateNumber ? `Placa ${activeRider.plateNumber}` : session?.user.email}</Text>
              <Text style={styles.online}>{activeRider?.status === "active" ? "En linea" : "Revisar membresia"}</Text>
            </View>
          </View>

          <View style={styles.walletCard}>
            <View style={styles.walletCopy}>
              <Text style={styles.walletLabel}>Ganancias registradas</Text>
              <Text style={styles.walletValue}>{moneyBob(earnings)}</Text>
              <Text style={styles.walletHint}>{delivered.length} entregas completadas</Text>
            </View>
            <Image source={RiderAssets.illustrations.earningsWallet} style={styles.walletImage} contentFit="contain" />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {refreshing ? <ActivityIndicator color={RiderColors.lime} /> : null}

          <View style={styles.menu}>
            <MenuRow icon={Store} title="Restaurantes" subtitle={activeRestaurants || "Sin restaurantes activos"} />
            <MenuRow icon={UserCheck} title="Membresia" subtitle={activeRider ? `Valida hasta ${shortDate(activeRider.membershipValidUntil)}` : "Sin datos"} />
            <MenuRow icon={BarChart3} title="Mis estadisticas" subtitle={`${delivered.length} carreras completadas`} />
            <MenuRow icon={CreditCard} title="Metodos de pago" subtitle="Configuracion disponible en yopido.shop" />
            <MenuRow icon={Headphones} title="Centro de ayuda" subtitle="Soporte para riders" />
            <MenuRow icon={Phone} title="Telefono" subtitle={activeRider?.phone || "No registrado"} />
            <MenuRow icon={Mail} title="Correo" subtitle={session?.user.email ?? "No registrado"} />
          </View>

          <PrimaryButton onPress={() => void signOut()} tone="red">
            <Text style={styles.logoutText}>Cerrar sesion</Text>
          </PrimaryButton>
        </ScrollView>
      </SafeAreaView>
    </RiderScreen>
  );
}

function MenuRow({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.menuIcon}>
        <Icon color={RiderColors.blue900} size={20} strokeWidth={2.4} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>{">"}</Text>
    </View>
  );
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
  brandRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: RiderColors.card,
    borderRadius: 28,
    flexDirection: "row",
    gap: 16,
    padding: 18,
  },
  avatar: {
    height: 86,
    width: 86,
  },
  avatarWrap: {
    alignItems: "center",
    backgroundColor: RiderColors.soft,
    borderColor: RiderColors.lime,
    borderRadius: 43,
    borderWidth: 2,
    height: 86,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: 86,
  },
  profileText: {
    flex: 1,
  },
  name: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 21,
    fontWeight: "900",
  },
  rating: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.bold,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 7,
  },
  online: {
    color: RiderColors.limeDark,
    fontFamily: RiderFonts.black,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  walletCard: {
    alignItems: "center",
    backgroundColor: RiderColors.blue900,
    borderRadius: 28,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    minHeight: 116,
    padding: 20,
  },
  walletCopy: {
    flex: 1,
  },
  walletImage: {
    height: 86,
    width: 86,
  },
  walletLabel: {
    color: RiderColors.white,
    fontFamily: RiderFonts.bold,
    fontSize: 13,
    fontWeight: "800",
  },
  walletValue: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 8,
  },
  walletHint: {
    color: RiderColors.lime,
    fontFamily: RiderFonts.extraBold,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
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
  menu: {
    backgroundColor: RiderColors.card,
    borderRadius: 24,
    overflow: "hidden",
  },
  menuRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: RiderColors.line,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 76,
    paddingHorizontal: 18,
  },
  menuIcon: {
    alignItems: "center",
    backgroundColor: RiderColors.soft,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginRight: 12,
    width: 36,
  },
  menuText: {
    flex: 1,
    paddingRight: 12,
  },
  menuTitle: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
  menuSubtitle: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  chevron: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.black,
    fontSize: 22,
    fontWeight: "900",
  },
  logoutText: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
});
