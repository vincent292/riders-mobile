import { useState } from "react";
import { Check, CheckCircle2, Clock3, MapPin, MessageCircle, Navigation, Package, Phone, Store, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LiveRiderMap } from "./live-rider-map";
import { PrimaryButton } from "./rider-ui";
import { RiderColors as C, RiderFonts as F } from "@/constants/rider-theme";
import { type RideOffer, useRiderDashboard } from "@/context/rider-dashboard";
import { cashToCollect, offerSeconds, orderDestination } from "@/lib/rider-domain";
import { distanceKm, formatDistance, moneyBob } from "@/lib/geo";
import { contactPhone, openDeliveryMaps } from "@/lib/rider-links";
import type { MobileRiderOrder } from "@/lib/rider-api";

export function RideOfferCard({ ride, now }: { ride: RideOffer; now: number }) {
  const dashboard = useRiderDashboard();
  const remaining = offerSeconds(ride.expiresAt, now);
  const expired = remaining === 0;
  const order = ride.order;
  const busy = Boolean(dashboard.pending) || Boolean(dashboard.error) || (dashboard.lastSync != null && now - dashboard.lastSync > 65000);
  return <View style={styles.offer}>
    <View style={styles.between}>
      <Text style={styles.eyebrow}>{ride.offerId ? "OFERTA PARA TI" : "ENTREGA DISPONIBLE"}</Text>
      {remaining != null ? <View style={styles.inline}><Clock3 size={15} color={remaining < 15 ? C.red : C.muted} /><Text style={[styles.meta, remaining < 15 && { color: C.red }]}>{expired ? "Vencida" : `${remaining}s`}</Text></View> : null}
    </View>
    <View style={styles.between}>
      <View style={styles.flex}><Text style={styles.title}>{order.restaurant.name}</Text><Text style={styles.meta}>Pedido #{order.orderNumber}</Text></View>
      <View><Text style={styles.fee}>{moneyBob(order.deliveryFee)}</Text><Text style={styles.meta}>Tarifa de entrega</Text></View>
    </View>
    <RouteSummary order={order} />
    <View style={styles.between}>
      <Text style={styles.meta}>{formatDistance(distanceKm(dashboard.location.position, orderDestination(order)))} en línea recta</Text>
      <Text style={styles.meta}>{order.items.reduce((sum, item) => sum + item.quantity, 0)} productos</Text>
    </View>
    <View style={styles.inline}>
      <PrimaryButton accessibilityLabel="Rechazar oferta" disabled={busy} onPress={() => { void dashboard.reject(ride); }} tone="dark"><X size={21} color={C.white} /></PrimaryButton>
      <PrimaryButton style={styles.flex} disabled={busy || expired} loading={dashboard.pending === ride.key} onPress={() => { void dashboard.accept(ride); }}>
        <View style={styles.inline}><Check size={20} color={C.ink} /><Text style={styles.button}>{expired ? "Oferta vencida" : "Aceptar entrega"}</Text></View>
      </PrimaryButton>
    </View>
  </View>;
}

export function ActiveDeliveryCard({ order }: { order: MobileRiderOrder }) {
  const dashboard = useRiderDashboard();
  const [itemsOpen, setItemsOpen] = useState(false);
  const arrived = order.dispatch?.status === "arrived";
  const cash = cashToCollect(order);
  return <View style={styles.active}>
    <View style={styles.map}>
      <LiveRiderMap currentLocation={dashboard.location.position} destination={orderDestination(order)} />
    </View>
    <View style={styles.between}>
      <View style={styles.flex}><Text style={styles.eyebrow}>PEDIDO #{order.orderNumber}</Text><Text style={styles.heading}>{arrived ? "Completa la entrega" : "Tu entrega en curso"}</Text></View>
      <View style={styles.status}><Package size={18} color={C.teal} /><Text style={styles.statusText}>{arrived ? "En destino" : "En curso"}</Text></View>
    </View>
    <View style={styles.progress}>
      {["Aceptada", "En destino", "Entregada"].map((label, i) => <View key={label} style={styles.step}>
        <View style={[styles.stepBar, i <= (arrived ? 1 : 0) && { backgroundColor: C.teal }]} />
        <Text style={styles.meta}>{label}</Text>
      </View>)}
    </View>
    <RouteSummary order={order} />
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>CLIENTE</Text>
      <Text style={styles.title}>{order.customerName || "Cliente"}</Text>
      <View style={styles.inline}>
        <ContactButton label="Llamar al cliente" phone={order.customerPhone} />
        <ContactButton label="WhatsApp del cliente" phone={order.customerPhone} whatsapp message={`Hola, soy tu rider de Yopido para el pedido #${order.orderNumber}.`} />
        <Text style={[styles.meta, styles.flex]}>{order.customerPhone || "Teléfono no registrado"}</Text>
      </View>
      {order.notes ? <Text style={styles.note}>{order.notes}</Text> : null}
    </View>
    <View style={styles.payment}>
      <View style={styles.flex}><Text style={styles.sectionLabel}>{cash > 0 ? "COBRAR EN EFECTIVO" : order.paymentStatus === "paid" ? "PAGO CONFIRMADO" : "ESTADO DEL PAGO"}</Text>
        <Text style={styles.meta}>{cash > 0 ? "Total del pedido, envío incluido" : order.paymentStatus === "paid" ? "No vuelvas a cobrar al cliente" : "Confirma el pago con el restaurante"}</Text></View>
      <Text style={styles.fee}>{moneyBob(cash > 0 ? cash : order.total)}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: itemsOpen }} onPress={() => setItemsOpen(!itemsOpen)} style={styles.disclosure}>
      <Package size={19} color={C.ink} /><Text style={[styles.button, styles.flex]}>Detalle del pedido</Text><Text style={styles.meta}>{itemsOpen ? "Ocultar" : `${order.items.length} ítems`}</Text>
    </Pressable>
    {itemsOpen ? <View style={styles.items}>{order.items.map((item) => <View key={item.id} style={styles.item}><Text style={styles.body}>{item.quantity} × {item.productName}</Text>{item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}</View>)}</View> : null}
    <View style={styles.between}><Text style={styles.meta}>Restaurante · {order.restaurant.name}</Text><ContactButton label="Contactar al restaurante" phone={order.restaurant.whatsapp} whatsapp /></View>
  </View>;
}

export function ActiveDeliveryActions({ order }: { order: MobileRiderOrder }) {
  const dashboard = useRiderDashboard();
  const [confirm, setConfirm] = useState(false);
  const arrived = order.dispatch?.status === "arrived";
  const cash = cashToCollect(order);
  const pending = dashboard.pending === "status";
  const blocked = Boolean(dashboard.pending) || Boolean(dashboard.error);
  return <View style={styles.footer}>
    <PrimaryButton accessibilityLabel="Navegar al cliente" tone="dark" onPress={() => { void openDeliveryMaps(order, dashboard.location.position); }}><Navigation size={21} color={C.white} /></PrimaryButton>
    <PrimaryButton style={styles.flex} loading={pending} disabled={blocked} onPress={() => { if (arrived) setConfirm(true); else void dashboard.updateStatus(order, "arrived"); }}>
      <View style={styles.inline}><CheckCircle2 size={20} color={C.ink} /><Text style={styles.button}>{arrived ? "Confirmar entrega" : "Llegué al cliente"}</Text></View>
    </PrimaryButton>
    <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!pending) setConfirm(false); }}>
      <View style={styles.scrim}><View accessibilityViewIsModal style={styles.modal}><ScrollView contentContainerStyle={styles.modalContent}>
        <CheckCircle2 size={36} color={C.teal} />
        <Text style={styles.heading}>¿Pedido entregado?</Text>
        <Text style={styles.body}>Pedido #{order.orderNumber} para {order.customerName}.</Text>
        <Text style={styles.body}>{cash > 0 ? `Confirma que entregaste los productos y cobraste ${moneyBob(cash)} en efectivo.` : "Confirma que el cliente recibió todos los productos."}</Text>
        {dashboard.actionError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{dashboard.actionError}</Text> : null}
        <PrimaryButton disabled={blocked} loading={pending} onPress={() => { void dashboard.updateStatus(order, "delivered").then((ok) => { if (ok) setConfirm(false); }); }}><Text style={styles.button}>Sí, pedido entregado</Text></PrimaryButton>
        <PrimaryButton disabled={pending} tone="dark" onPress={() => setConfirm(false)}><Text style={[styles.button, { color: C.white }]}>Volver a la entrega</Text></PrimaryButton>
      </ScrollView></View></View>
    </Modal>
  </View>;
}

function RouteSummary({ order }: { order: MobileRiderOrder }) {
  return <View style={styles.route}>
    <View style={styles.routeRow}><Store size={19} color={C.orange} /><View style={styles.flex}><Text style={styles.sectionLabel}>RECOGIDA · #{order.orderNumber}</Text><Text style={styles.body}>{order.restaurant.name}</Text><Text style={styles.meta}>{order.restaurant.city}</Text></View></View>
    <View style={styles.routeRow}><MapPin size={19} color={C.teal} /><View style={styles.flex}><Text style={styles.sectionLabel}>DESTINO</Text><Text style={styles.body}>{order.customerAddress || "Dirección por confirmar"}</Text>{order.deliveryAddressDetail ? <Text style={styles.meta}>{order.deliveryAddressDetail}</Text> : null}</View></View>
  </View>;
}

export function ContactButton({ phone, label, whatsapp = false, message = "" }: { phone: string; label: string; whatsapp?: boolean; message?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !phone }} disabled={!phone} onPress={() => contactPhone(phone, whatsapp, message)} style={({ pressed }) => [styles.contact, (!phone || pressed) && { opacity: 0.4 }]}>{whatsapp ? <MessageCircle size={21} color={C.teal} /> : <Phone size={21} color={C.teal} />}</Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  offer: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 8, padding: 16, gap: 16 },
  active: { gap: 18 },
  eyebrow: { fontFamily: F.bold, fontSize: 11, color: C.teal },
  title: { fontFamily: F.semibold, fontSize: 17, color: C.ink },
  heading: { fontFamily: F.bold, fontSize: 22, color: C.ink },
  fee: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  meta: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: C.muted, flexShrink: 1 },
  sectionLabel: { fontFamily: F.semibold, fontSize: 11, color: C.muted, marginBottom: 4 },
  body: { fontFamily: F.regular, fontSize: 14, lineHeight: 22, color: C.ink },
  button: { fontFamily: F.semibold, fontSize: 14, color: C.ink, flexShrink: 1, textAlign: "center" },
  route: { gap: 18, paddingVertical: 8 },
  routeRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  map: { height: 230, marginHorizontal: -18, backgroundColor: C.line },
  footer: { flexDirection: "row", gap: 12, padding: 12, paddingHorizontal: 18, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.white, width: "100%", maxWidth: 720, alignSelf: "center" },
  status: { flexDirection: "row", gap: 6, alignItems: "center" },
  statusText: { color: C.teal, fontFamily: F.semibold, fontSize: 12 },
  progress: { flexDirection: "row", gap: 10 },
  step: { flex: 1, gap: 6 },
  stepBar: { height: 4, backgroundColor: C.line, borderRadius: 2 },
  section: { borderTopWidth: 1, borderColor: C.line, paddingTop: 18, gap: 8 },
  contact: { width: 48, height: 48, backgroundColor: "#E5F1ED", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  note: { fontFamily: F.regular, fontSize: 14, lineHeight: 22, color: C.orange },
  payment: { backgroundColor: "#EBF0DC", flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", paddingVertical: 18, paddingHorizontal: 18, marginHorizontal: -18 },
  disclosure: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  items: { gap: 12 }, item: { borderBottomWidth: 1, borderColor: C.line, paddingBottom: 10 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.card, borderRadius: 8, width: "100%", maxWidth: 440, maxHeight: "90%" },
  modalContent: { padding: 24, gap: 18 },
  error: { color: C.red, fontSize: 13, fontFamily: F.regular },
});
