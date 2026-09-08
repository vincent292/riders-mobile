import { useMemo, useState } from "react";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Bell, ChevronRight, Clock3, LogOut, Mail, Phone, Settings, ShieldCheck, Store, type LucideIcon } from "lucide-react-native";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthGate } from "@/components/auth-gate";
import { ContactButton } from "@/components/delivery-card";
import { PrimaryButton, RiderHeader, RiderScreen, StatusNotice } from "@/components/rider-ui";
import { useRiderNotifications } from "@/components/rider-notifications";
import { RiderAssets } from "@/constants/rider-assets";
import { RiderColors as C, RiderFonts as F } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { useRiderDashboard } from "@/context/rider-dashboard";
import { useClock } from "@/hooks/use-clock";
import { useRiderHistory } from "@/hooks/use-rider-history";
import { shortDate } from "@/lib/geo";
import { isDelivered } from "@/lib/rider-domain";
import { riderErrorMessage } from "@/lib/rider-api";

export default function ProfileScreen() { return <AuthGate><ProfileContent /></AuthGate>; }

function ProfileContent() {
  const { session, refreshSession, signOut } = useRiderAuth();
  const dashboard = useRiderDashboard();
  const history = useRiderHistory();
  const notifications = useRiderNotifications();
  const router = useRouter();
  const now = useClock(30000);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rider = session?.activeRiders[0] ?? session?.riders[0];
  const deliverySummary = useMemo(() => {
    const completed = history.orders.filter(isDelivered);
    return {
      completed: completed.length,
      deliveryFees: completed.reduce((sum, order) => sum + order.deliveryFee, 0),
      orderTotal: completed.reduce((sum, order) => sum + order.total, 0),
    };
  }, [history.orders]);
  async function refresh() {
    setRefreshing(true); setError("");
    try { await refreshSession(); } catch (err) { setError(riderErrorMessage(err)); }
    finally { setRefreshing(false); }
  }
  async function logout() {
    setLoggingOut(true); setError("");
    try {
      if (dashboard.activeOrder || !dashboard.loaded || dashboard.error) { setError("Actualiza tus entregas antes de cerrar sesión. Finaliza cualquier entrega activa."); return; }
      if (dashboard.available && !(await dashboard.toggleAvailability(false))) { setError("No pudimos cerrar tu turno. Revisa la conexión e inténtalo nuevamente."); return; }
      await signOut();
    } catch (err) { setError(riderErrorMessage(err)); }
    finally { setLoggingOut(false); }
  }
  const pushLabel = notifications.status === "ready" ? "Avisos conectados" : notifications.status === "denied" ? "Permiso pendiente" : notifications.status === "unsupported" ? "Disponibles en la app Android instalada" : notifications.status === "checking" ? "Conectando avisos" : "Reintentar conexión";

  return <RiderScreen><SafeAreaView style={styles.flex} edges={["top"]}>
    <RiderHeader title="Mi cuenta" subtitle="Yopido Riders" />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={C.teal} />}>
      <View style={styles.identity}><View style={styles.avatar}><Image source={RiderAssets.illustrations.riderStanding} style={styles.avatarImage} contentFit="contain" /></View><View style={styles.flex}><Text style={styles.name}>{rider?.fullName || "Rider"}</Text><Text style={styles.meta}>{rider?.plateNumber ? `Placa ${rider.plateNumber}` : "Placa sin registrar"}</Text><View style={styles.verified}><ShieldCheck size={15} color={C.teal} /><Text style={styles.verifiedText}>{session?.activeRiders.length ? "Afiliación activa" : "Afiliación pendiente"}</Text></View></View></View>
      {error ? <StatusNotice tone="error" text={error} onRetry={() => { void refresh(); }} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Ver resumen de entregas" onPress={() => router.push("/historial")} style={({ pressed }) => [styles.deliverySummary, pressed && { opacity: 0.72 }]}>
        <View><Text style={styles.summaryEyebrow}>MIS ENTREGAS</Text><Text style={styles.summaryCount}>{history.loaded ? `${deliverySummary.completed} completadas` : "Actualizando actividad"}</Text></View>
        <View style={styles.summaryAmount}><Text style={styles.summaryFee}>{history.loaded ? `Bs ${deliverySummary.deliveryFees.toFixed(2)}` : "--"}</Text><Text style={styles.summaryLabel}>Tarifas acumuladas</Text></View>
        {history.loaded ? <Text style={styles.summaryOrderTotal}>Pedidos: Bs {deliverySummary.orderTotal.toFixed(2)}</Text> : null}
      </Pressable>
      <Text style={styles.sectionTitle}>Mis restaurantes</Text>
      {session?.riders.length ? session.riders.map((membership) => {
        const remaining = Math.ceil((Date.parse(membership.membershipValidUntil) - now) / 86400000);
        const valid = membership.status === "active" && remaining > 0;
        return <View style={styles.membership} key={membership.id}>
          <View style={styles.restaurantTop}><Store size={20} color={C.teal} /><Text style={[styles.restaurantName, styles.flex]}>{membership.restaurantName}</Text><ContactButton phone={membership.restaurantWhatsapp} label={`Soporte de ${membership.restaurantName}`} whatsapp message="Hola, necesito ayuda con mi cuenta de Yopido Riders." /></View>
          <Text style={styles.meta}>{membership.restaurantCity}</Text>
          <View style={styles.memberBottom}><Text style={[styles.status, { color: valid ? C.teal : C.red }]}>{membership.status === "suspended" ? "Suspendida" : valid ? "Activa" : "Vencida"}</Text><Text style={styles.meta}>{membership.membershipValidUntil ? `Hasta ${shortDate(membership.membershipValidUntil)} · ${new Date(membership.membershipValidUntil).getFullYear()}` : "Sin fecha de vigencia"}</Text></View>
          {valid && remaining <= 7 ? <Text style={styles.expiry}>Vence en {remaining} {remaining === 1 ? "día" : "días"}. Coordina la renovación con tu restaurante.</Text> : null}
        </View>;
      }) : <StatusNotice text="Todavía no tienes restaurantes vinculados a esta cuenta." />}
      <Text style={styles.sectionTitle}>Actividad y preferencias</Text>
      <View>
        <ProfileRow icon={Clock3} title="Mis entregas" subtitle="Historial y tarifas registradas" onPress={() => router.push("/historial")} />
        <ProfileRow icon={Bell} title="Notificaciones" subtitle={pushLabel} onPress={notifications.status === "unsupported" ? undefined : () => { void notifications.retry(); }} />
        <ProfileRow icon={Settings} title="Permisos del teléfono" subtitle="Ubicación y avisos" onPress={() => { void Linking.openSettings().catch(() => setError("Abre los ajustes de Yopido Riders en tu teléfono.")); }} />
      </View>
      <Text style={styles.sectionTitle}>Datos de contacto</Text>
      <View><ProfileRow icon={Phone} title="Teléfono" subtitle={rider?.phone || "Sin registrar"} /><ProfileRow icon={Mail} title="Correo" subtitle={session?.user.email || "Sin registrar"} /></View>
      <Text style={styles.meta}>Para actualizar tus datos o resolver un cobro, contacta a tu restaurante.</Text>
      <PrimaryButton tone="dark" loading={loggingOut} disabled={!!dashboard.activeOrder || !!dashboard.pending} onPress={() => Alert.alert("Cerrar sesión", dashboard.available ? "Se cerrará tu turno antes de salir." : "Podrás volver a entrar con tu cuenta.", [{ text: "Cancelar", style: "cancel" }, { text: "Cerrar sesión", onPress: () => { void logout(); } }])}><View style={styles.logout}><LogOut size={18} color={C.white} /><Text style={styles.logoutText}>Cerrar sesión</Text></View></PrimaryButton>
      {dashboard.activeOrder ? <Text style={styles.meta}>Termina tu entrega para cerrar sesión.</Text> : null}
      <Text style={styles.version}>Yopido Riders · {Constants.expoConfig?.version ?? "1.0.0"}</Text>
    </ScrollView>
  </SafeAreaView></RiderScreen>;
}

function ProfileRow({ icon: Icon, title, subtitle, onPress }: { icon: LucideIcon; title: string; subtitle: string; onPress?: () => void }) {
  const content = <><Icon size={20} color={C.muted} /><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.meta}>{subtitle}</Text></View>{onPress ? <ChevronRight size={18} color={C.muted} /> : null}</>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>{content}</Pressable> : <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, content: { gap: 16, padding: 18, paddingBottom: 32, alignSelf: "center", width: "100%", maxWidth: 720 },
  identity: { flexDirection: "row", gap: 18, alignItems: "center", paddingBottom: 16, borderBottomWidth: 1, borderColor: C.line },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#E6EDD4", overflow: "hidden" },
  avatarImage: { width: 80, height: 96 },
  name: { fontFamily: F.bold, fontSize: 21, color: C.ink },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted, lineHeight: 19, flexShrink: 1 },
  verified: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 7 },
  verifiedText: { fontFamily: F.semibold, fontSize: 11, color: C.teal },
  sectionTitle: { fontFamily: F.semibold, fontSize: 16, color: C.ink, marginTop: 6 },
  membership: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 8 },
  deliverySummary: { backgroundColor: C.blue950, borderRadius: 18, gap: 6, padding: 18 },
  summaryEyebrow: { color: "#CDD8D0", fontFamily: F.semibold, fontSize: 11 },
  summaryCount: { color: C.white, fontFamily: F.bold, fontSize: 19, marginTop: 2 },
  summaryAmount: { alignItems: "baseline", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  summaryFee: { color: C.lime, fontFamily: F.bold, fontSize: 24 },
  summaryLabel: { color: "#CDD8D0", fontFamily: F.regular, fontSize: 12 },
  summaryOrderTotal: { color: "#CDD8D0", fontFamily: F.regular, fontSize: 12, marginTop: 2 },
  restaurantTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  restaurantName: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  memberBottom: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  status: { fontFamily: F.semibold, fontSize: 12 },
  expiry: { color: C.orange, fontFamily: F.regular, fontSize: 12, lineHeight: 19 },
  row: { flexDirection: "row", gap: 14, alignItems: "center", minHeight: 76, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line },
  rowTitle: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  logout: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoutText: { fontFamily: F.semibold, fontSize: 14, color: C.white },
  version: { textAlign: "center", fontFamily: F.regular, fontSize: 11, color: C.muted, paddingTop: 8 },
});
