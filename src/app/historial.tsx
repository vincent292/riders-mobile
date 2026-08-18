/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthGate } from "@/components/auth-gate";
import { EmptyRidesState, RiderHeader, RiderScreen } from "@/components/rider-ui";
import { RiderColors, RiderFonts } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { moneyBob, shortDate, shortTime } from "@/lib/geo";
import { listRiderOrders, riderErrorMessage, type MobileRiderOrder } from "@/lib/rider-api";

export default function HistoryScreen() {
  return (
    <AuthGate>
      <HistoryContent />
    </AuthGate>
  );
}

function HistoryContent() {
  const { session } = useRiderAuth();
  const [orders, setOrders] = useState<MobileRiderOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const token = session?.accessToken ?? "";

  const deliveredOrders = orders.filter((order) => order.dispatch?.status === "delivered" || order.status === "delivered");
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = deliveredOrders.filter((order) => (order.deliveredAt ?? order.dispatch?.deliveredAt ?? "").slice(0, 10) === today);
  const todayEarnings = todayOrders.reduce((sum, order) => sum + order.deliveryFee, 0);

  const groupedOrders = deliveredOrders.reduce<{ label: string; data: MobileRiderOrder[] }[]>((groups, order) => {
    const date = shortDate(order.deliveredAt ?? order.dispatch?.deliveredAt ?? order.createdAt) || "Recientes";
    const current = groups.find((group) => group.label === date);
    if (current) current.data.push(order);
    else groups.push({ label: date, data: [order] });
    return groups;
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    const result = await listRiderOrders(token, "history");
    setOrders(result.orders);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((loadError) => setError(riderErrorMessage(loadError)))
      .finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      await load();
    } catch (refreshError) {
      setError(riderErrorMessage(refreshError));
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <RiderScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <RiderHeader title="Historial" />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={RiderColors.lime} />}
          showsVerticalScrollIndicator={false}>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Hoy</Text>
              <Text style={styles.summaryValue}>{todayOrders.length} carreras</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={[styles.summaryItem, styles.summaryItemRight]}>
              <Text style={styles.summaryLabel}>Ganancias del dia</Text>
              <Text style={styles.summaryMoney}>{moneyBob(todayEarnings)}</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color={RiderColors.lime} size="large" /> : null}

          {groupedOrders.length ? (
            groupedOrders.map((group) => (
              <View key={group.label} style={styles.group}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <View style={styles.list}>
                  {group.data.map((order) => (
                    <View key={order.id} style={styles.row}>
                      <View style={styles.timeCol}>
                        <Text style={styles.time}>{shortTime(order.deliveredAt ?? order.dispatch?.deliveredAt ?? order.createdAt)}</Text>
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.restaurant}>{order.restaurant.name}</Text>
                        <Text style={styles.address}>{order.customerAddress || order.customerName}</Text>
                        <Text style={styles.status}>Completada</Text>
                      </View>
                      <Text style={styles.payout}>{moneyBob(order.deliveryFee)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : !loading ? (
            <EmptyRidesState title="Aun no tienes carreras" text="Tus pedidos entregados apareceran aqui." />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </RiderScreen>
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
  summary: {
    backgroundColor: RiderColors.card,
    borderRadius: 8,
    flexDirection: "row",
    minHeight: 92,
    padding: 18,
  },
  summaryItem: {
    flex: 1,
    justifyContent: "center",
  },
  summaryItemRight: {
    alignItems: "flex-end",
  },
  summaryDivider: {
    backgroundColor: RiderColors.line,
    marginHorizontal: 14,
    width: 1,
  },
  summaryLabel: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.extraBold,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryValue: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },
  summaryMoney: {
    color: RiderColors.limeDark,
    fontFamily: RiderFonts.black,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
    textAlign: "right",
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
  group: {
    gap: 8,
  },
  groupTitle: {
    color: RiderColors.white,
    fontFamily: RiderFonts.black,
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 4,
    textTransform: "uppercase",
  },
  list: {
    backgroundColor: RiderColors.card,
    borderRadius: 8,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: RiderColors.line,
    flexDirection: "row",
    gap: 12,
    minHeight: 88,
    paddingHorizontal: 16,
  },
  timeCol: {
    width: 74,
  },
  time: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.extraBold,
    fontSize: 12,
    fontWeight: "800",
  },
  detailCol: {
    flex: 1,
  },
  restaurant: {
    color: RiderColors.ink,
    fontFamily: RiderFonts.black,
    fontSize: 15,
    fontWeight: "900",
  },
  address: {
    color: RiderColors.muted,
    fontFamily: RiderFonts.bold,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  status: {
    color: RiderColors.limeDark,
    fontFamily: RiderFonts.black,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 5,
  },
  payout: {
    color: RiderColors.limeDark,
    fontFamily: RiderFonts.black,
    fontSize: 13,
    fontWeight: "900",
  },
});
