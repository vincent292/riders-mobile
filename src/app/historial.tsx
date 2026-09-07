import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Search, X } from "lucide-react-native";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthGate } from "@/components/auth-gate";
import { EmptyRidesState, RiderHeader, RiderScreen, StatusNotice } from "@/components/rider-ui";
import { RiderColors as C, RiderFonts as F } from "@/constants/rider-theme";
import { useRiderHistory } from "@/hooks/use-rider-history";
import { useClock } from "@/hooks/use-clock";
import { boliviaDay, deliveryDate, inHistoryPeriod, isDelivered, type HistoryPeriod } from "@/lib/rider-domain";
import { moneyBob, shortDate, shortTime } from "@/lib/geo";
import type { MobileRiderOrder } from "@/lib/rider-api";

const periods: { key: HistoryPeriod; label: string }[] = [{ key: "today", label: "Hoy" }, { key: "week", label: "7 días" }, { key: "month", label: "30 días" }, { key: "all", label: "Todo" }];
export default function HistoryScreen() { return <AuthGate><HistoryContent /></AuthGate>; }

function HistoryContent() {
  const history = useRiderHistory();
  const [period, setPeriod] = useState<HistoryPeriod>("week");
  const [query, setQuery] = useState("");
  const now = useClock(30000);
  const filtered = useMemo(() => history.orders.filter((order) => isDelivered(order) && inHistoryPeriod(deliveryDate(order), period, now) &&
    `${order.orderNumber} ${order.restaurant.name} ${order.customerAddress}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => Date.parse(deliveryDate(b)) - Date.parse(deliveryDate(a))), [history.orders, now, period, query]);
  const total = filtered.reduce((sum, order) => sum + order.deliveryFee, 0);
  const groups = useMemo(() => {
    const result = new Map<string, MobileRiderOrder[]>();
    filtered.forEach((order) => { const key = boliviaDay(deliveryDate(order)); result.set(key, [...(result.get(key) ?? []), order]); });
    return [...result.entries()];
  }, [filtered]);

  return <RiderScreen><SafeAreaView style={styles.flex} edges={["top"]}>
    <RiderHeader title="Tu actividad" subtitle="Entregas y tarifas registradas" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={history.loading && history.loaded} onRefresh={() => { void history.refresh(); }} tintColor={C.teal} />}>
      <View accessibilityRole="tablist" style={styles.periods}>{periods.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: item.key === period }} onPress={() => setPeriod(item.key)} style={[styles.period, item.key === period && styles.selected]}><Text style={[styles.periodText, item.key === period && { color: C.ink }]}>{item.label}</Text></Pressable>)}</View>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>TARIFAS DE ENTREGA</Text>
        <Text style={styles.total}>{history.loaded ? moneyBob(total) : "--"}</Text>
        <View style={styles.summaryBottom}><CheckCircle2 size={17} color={C.lime} /><Text style={styles.summaryCaption}>{history.loaded ? `${filtered.length} entregas completadas` : "Consultando actividad"}</Text></View>
      </View>
      <View style={styles.search}><Search size={18} color={C.muted} /><TextInput accessibilityLabel="Buscar pedido o restaurante" value={query} onChangeText={setQuery} placeholder="Pedido, restaurante o dirección" placeholderTextColor={C.muted} style={styles.input} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setQuery("")} style={styles.clear}><X size={18} color={C.muted} /></Pressable> : null}</View>
      {history.error ? <StatusNotice tone="error" text={history.error} onRetry={() => { void history.refresh(); }} /> : null}
      {!history.loaded && history.loading ? <ActivityIndicator size="large" color={C.teal} /> : null}
      {groups.map(([day, orders]) => <View key={day} style={styles.group}>
        <Text style={styles.date}>{day === boliviaDay(now) ? "Hoy" : `${shortDate(deliveryDate(orders[0]))} · ${day.slice(0, 4)}`}</Text>
        {orders.map((order) => <HistoryRow key={order.id} order={order} />)}
      </View>)}
      {history.loaded && !filtered.length ? <EmptyRidesState title={query ? "Sin coincidencias" : "Sin entregas en este período"} text={query ? "No hay pedidos que coincidan con tu búsqueda." : "Tu actividad aparecerá cuando completes una entrega."} /> : null}
      {history.loaded && filtered.length > 0 ? <Text style={styles.footnote}>Tarifas de los pedidos registrados. La liquidación se coordina con cada restaurante.</Text> : null}
    </ScrollView>
  </SafeAreaView></RiderScreen>;
}

function HistoryRow({ order }: { order: MobileRiderOrder }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Pedido ${order.orderNumber}`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.rowMain}>
      <View style={styles.check}><CheckCircle2 size={21} color={C.teal} /></View>
      <View style={styles.flex}><Text style={styles.restaurant}>{order.restaurant.name}</Text><Text style={styles.meta}>#{order.orderNumber} · {shortTime(deliveryDate(order))}</Text></View>
      <Text style={styles.fee}>{moneyBob(order.deliveryFee)}</Text><ChevronDown size={16} color={C.muted} style={expanded ? { transform: [{ rotate: "180deg" }] } : undefined} />
    </Pressable>
    {expanded ? <View style={styles.details}><Text style={styles.body}>{order.customerAddress || "Dirección no registrada"}</Text><Text style={styles.meta}>Total del pedido: {moneyBob(order.total)}</Text><Text style={styles.meta}>{order.items.reduce((sum, item) => sum + item.quantity, 0)} productos · Entrega completada</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 18, paddingTop: 4, paddingBottom: 32, gap: 20, alignSelf: "center", width: "100%", maxWidth: 720 },
  periods: { flexDirection: "row", padding: 4, borderRadius: 8, backgroundColor: "#E6EBE7", gap: 4 },
  period: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 6 },
  selected: { backgroundColor: C.white },
  periodText: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  summary: { backgroundColor: C.blue950, marginHorizontal: -18, paddingHorizontal: 22, paddingVertical: 24, gap: 10 },
  summaryLabel: { color: "#CDD8D0", fontFamily: F.semibold, fontSize: 11 },
  total: { color: C.white, fontFamily: F.bold, fontSize: 34 },
  summaryBottom: { flexDirection: "row", gap: 8, alignItems: "center" },
  summaryCaption: { color: C.lime, fontFamily: F.regular, fontSize: 13 },
  search: { flexDirection: "row", alignItems: "center", paddingLeft: 14, gap: 10, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.line },
  input: { flex: 1, minWidth: 0, minHeight: 50, fontFamily: F.regular, fontSize: 13, color: C.ink },
  clear: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  group: { gap: 0 },
  date: { fontFamily: F.semibold, fontSize: 13, color: C.muted, paddingBottom: 10 },
  row: { borderBottomWidth: 1, borderColor: C.line },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  check: { height: 38, width: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#E0EEE6", borderRadius: 8 },
  restaurant: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted, lineHeight: 19 },
  fee: { fontFamily: F.semibold, fontSize: 13, color: C.ink, maxWidth: 95 },
  details: { paddingBottom: 18, paddingLeft: 48, gap: 6 },
  body: { fontFamily: F.regular, fontSize: 13, color: C.ink },
  footnote: { fontFamily: F.regular, fontSize: 12, lineHeight: 19, color: C.muted },
});
