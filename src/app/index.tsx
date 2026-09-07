import { useState } from "react";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Bell, LocateFixed, Power, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthGate } from "@/components/auth-gate";
import { ActiveDeliveryActions, ActiveDeliveryCard, RideOfferCard } from "@/components/delivery-card";
import { EmptyRidesState, PrimaryButton, RiderHeader, RiderScreen, StatusNotice } from "@/components/rider-ui";
import { useRiderNotifications } from "@/components/rider-notifications";
import { RiderAssets } from "@/constants/rider-assets";
import { RiderColors as C, RiderFonts as F } from "@/constants/rider-theme";
import { useRiderAuth } from "@/context/rider-auth";
import { useRiderDashboard } from "@/context/rider-dashboard";
import { useClock } from "@/hooks/use-clock";
import { offerSeconds } from "@/lib/rider-domain";
import { requestBackgroundDelivery } from "@/lib/background-location";

export default function HomeScreen() { return <AuthGate><RiderHome /></AuthGate>; }

function RiderHome() {
  const dashboard = useRiderDashboard();
  const { session } = useRiderAuth();
  const notifications = useRiderNotifications();
  const router = useRouter();
  const now = useClock();
  const [locationPending, setLocationPending] = useState(false);
  const offers = dashboard.offers.filter((ride) => offerSeconds(ride.expiresAt, now) !== 0);
  const active = dashboard.activeOrder;
  const name = session?.activeRiders[0]?.fullName.split(" ")[0] || "Rider";
  const stale = dashboard.lastSync != null && now - dashboard.lastSync > 65000 && (dashboard.available || !!active);
  const canWork = Boolean(session?.activeRiders.length);

  async function retryLocation() {
    if (locationPending) return;
    setLocationPending(true);
    try { await dashboard.location.locate(); dashboard.location.retry(); }
    catch { Alert.alert("Ubicación no disponible", "Comprueba el permiso de ubicación y que el GPS esté encendido.", [{ text: "Volver" }, { text: "Ajustes", onPress: () => { void Linking.openSettings(); } }]); }
    finally { setLocationPending(false); }
  }

  function enableBackground() {
    Alert.alert("Ubicación durante la entrega", "Yopido compartirá tu ubicación con el cliente durante la entrega aunque abras otra aplicación o bloquees la pantalla. Android mostrará un aviso permanente. El seguimiento se detiene al finalizar la entrega. En los ajustes, permite la ubicación todo el tiempo.", [
      { text: "Ahora no", style: "cancel" },
      { text: "Continuar", onPress: () => { void requestBackgroundDelivery().then((enabled) => { dashboard.location.retry(); if (!enabled) Alert.alert("Permiso pendiente", "El seguimiento al salir de la app necesita permiso de ubicación en segundo plano y una instalación Android compatible."); }).catch(() => Alert.alert("No se pudo activar", "Revisa los permisos en Ajustes.")); } },
    ]);
  }

  return <RiderScreen><SafeAreaView style={styles.flex} edges={["top"]}>
    <RiderHeader title={active ? "Entrega activa" : `Hola, ${name}`} subtitle="Yopido Riders" action={<Pressable accessibilityRole="button" accessibilityLabel="Actualizar pedidos" disabled={dashboard.refreshing} onPress={() => { void dashboard.refresh(); }} style={styles.icon}>{dashboard.refreshing ? <ActivityIndicator color={C.teal} /> : <RefreshCw size={21} color={C.ink} />}</Pressable>} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={dashboard.refreshing} onRefresh={() => { void dashboard.refresh(); }} tintColor={C.teal} />}>
      <View style={styles.shift}>
        <View style={[styles.power, dashboard.available && { backgroundColor: C.lime }]}><Power size={21} color={dashboard.available ? C.ink : C.white} /></View>
        <View style={styles.flex}><Text style={styles.shiftTitle}>{active ? "Entrega en curso" : dashboard.available ? "Estás disponible" : "Fuera de turno"}</Text><Text style={styles.shiftText}>{active ? "Tu turno sigue activo hasta finalizar" : dashboard.available ? "Buscando entregas para ti" : "Listo cuando tú estés"}</Text></View>
        <Switch accessibilityLabel="Disponibilidad para entregas" disabled={!!dashboard.pending || !!active || !canWork || !dashboard.loaded || !!dashboard.error} value={dashboard.available} onValueChange={(next) => { void dashboard.toggleAvailability(next); }} trackColor={{ false: "#6C7771", true: C.lime }} thumbColor={C.white} />
      </View>
      {!canWork ? <StatusNotice text="Tu cuenta necesita una afiliación activa para recibir entregas." onRetry={() => router.push("/perfil")} /> : null}
      {dashboard.error || stale ? <StatusNotice tone="error" text={dashboard.error || "Los pedidos no se han actualizado recientemente. Comprueba tu conexión."} onRetry={() => { void dashboard.refresh(); }} /> : null}
      {dashboard.actionError ? <StatusNotice tone="error" text={dashboard.actionError} /> : null}
      {notifications.status === "denied" || notifications.status === "error" ? <Pressable accessibilityRole="button" accessibilityLabel="Activar avisos de pedidos" onPress={() => { void notifications.retry(); }} style={styles.notice}><Bell size={19} color={C.orange} /><Text style={styles.noticeText}>{notifications.status === "denied" ? "Activa los avisos para recibir nuevas ofertas" : "Avisos sin conectar · Reintentar"}</Text></Pressable> : null}
      {(dashboard.available || active) ? <Pressable accessibilityRole="button" accessibilityLabel="Actualizar ubicación" disabled={locationPending} onPress={() => { void retryLocation(); }} style={styles.location}><LocateFixed size={16} color={C.teal} /><Text style={styles.meta}>{locationPending ? "Obteniendo ubicación…" : dashboard.location.status}</Text></Pressable> : null}
      {!dashboard.loaded ? (dashboard.error ? null : <View style={styles.loading}><ActivityIndicator color={C.teal} /><Text style={styles.meta}>Consultando tus entregas…</Text></View>) : active ? <>
        {dashboard.activeOrders.length > 1 ? <StatusNotice text={`Tienes ${dashboard.activeOrders.length} entregas asignadas. La siguiente aparecerá al completar esta.`} /> : null}
        {Platform.OS === "android" && !dashboard.location.background ? <Pressable accessibilityRole="button" onPress={enableBackground} style={styles.notice}><LocateFixed size={19} color={C.orange} /><Text style={styles.noticeText}>Activar ubicación al salir de la app</Text></Pressable> : null}
        <ActiveDeliveryCard key={active.id} order={active} />
      </> : dashboard.available ? <>
        <View style={styles.sectionHeading}><Text style={styles.heading}>{offers.length ? "Ofertas disponibles" : "Buscando tu próxima entrega"}</Text>{offers.length ? <Text style={styles.count}>{offers.length}</Text> : null}</View>
        {offers.length ? offers.map((ride) => <RideOfferCard key={ride.key} ride={ride} now={now} />) : !dashboard.error ? <EmptyRidesState title="Todo listo por aquí" text="Por ahora no hay entregas disponibles en tus restaurantes." /> : null}
      </> : <View style={styles.offline}>
        <Image source={RiderAssets.illustrations.riderStanding} style={styles.illustration} contentFit="contain" />
        <Text style={styles.offlineTitle}>Un nuevo recorrido te espera</Text>
        <Text style={styles.offlineText}>{session?.activeRiders.length ?? 0} restaurantes vinculados a tu turno</Text>
        <PrimaryButton style={{ width: "100%" }} loading={dashboard.pending === "availability"} disabled={!canWork || !!dashboard.error || !!dashboard.pending} onPress={() => { void dashboard.toggleAvailability(true); }}><Text style={styles.button}>Comenzar turno</Text></PrimaryButton>
      </View>}
      {dashboard.lastSync ? <Text style={styles.sync}>Última actualización · {new Date(dashboard.lastSync).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</Text> : null}
    </ScrollView>
    {active ? <ActiveDeliveryActions key={active.id} order={active} /> : null}
  </SafeAreaView></RiderScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { gap: 16, paddingHorizontal: 18, paddingBottom: 32, alignSelf: "center", width: "100%", maxWidth: 720 },
  icon: { height: 48, width: 48, alignItems: "center", justifyContent: "center" },
  shift: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.blue950, padding: 16, marginHorizontal: -18 },
  power: { backgroundColor: "#35443D", height: 42, width: 42, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  shiftTitle: { color: C.white, fontSize: 16, fontFamily: F.semibold },
  shiftText: { color: "#CED8D0", fontSize: 12, lineHeight: 18, fontFamily: F.regular },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.warning, padding: 14, borderRadius: 8, minHeight: 48 },
  noticeText: { flex: 1, color: C.ink, fontFamily: F.regular, fontSize: 13, lineHeight: 20 },
  location: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted, flexShrink: 1 },
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 14 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heading: { fontFamily: F.semibold, fontSize: 18, color: C.ink, flex: 1 },
  count: { fontFamily: F.bold, fontSize: 16, color: C.teal },
  offline: { paddingVertical: 22, alignItems: "center", gap: 18 },
  illustration: { width: 180, height: 190 },
  offlineTitle: { fontFamily: F.bold, fontSize: 24, lineHeight: 32, color: C.ink, textAlign: "center", maxWidth: 320 },
  offlineText: { fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: "center" },
  button: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  sync: { fontFamily: F.regular, fontSize: 11, color: C.muted, textAlign: "center", paddingTop: 12 },
});
