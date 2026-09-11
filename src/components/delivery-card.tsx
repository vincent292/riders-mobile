import { useState } from "react";
import { Check, CheckCircle2, Clock3, KeyRound, MapPin, MessageCircle, Navigation, Package, Phone, Store, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LiveRiderMap } from "./live-rider-map";
import { PrimaryButton } from "./rider-ui";
import { RiderColors as C, RiderFonts as F } from "@/constants/rider-theme";
import { type RideOffer, useRiderDashboard } from "@/context/rider-dashboard";
import { activeOrderDestination, cashToCollect, hasPickedUpOrder, offerSeconds, orderDestination, orderPickup } from "@/lib/rider-domain";
import { distanceKm, formatDistance, moneyBob } from "@/lib/geo";
import { contactPhone, openActiveOrderMaps } from "@/lib/rider-links";
import type { MobileRiderOrder } from "@/lib/rider-api";

export function RideOfferCard({ ride, now }: { ride: RideOffer; now: number }) {
  const dashboard = useRiderDashboard();
  const remaining = offerSeconds(ride.expiresAt, now);
  const expired = remaining === 0;
  const order = ride.order;
  const busy = Boolean(dashboard.pending) || Boolean(dashboard.error) || (dashboard.lastSync != null && now - dashboard.lastSync > 65000);
  const previewItems = order.items.slice(0, 3);
  const extraItems = Math.max(0, order.items.length - previewItems.length);
  return <View style={styles.offer}>
    <View style={styles.between}>
      <Text style={styles.eyebrow}>{ride.offerId ? "OFERTA PARA TI" : "ENTREGA DISPONIBLE"}</Text>
      {remaining != null ? <View style={styles.inline}><Clock3 size={15} color={remaining < 15 ? C.red : C.muted} /><Text style={[styles.meta, remaining < 15 && { color: C.red }]}>{expired ? "Vencida" : `${remaining}s`}</Text></View> : null}
    </View>
    <View style={styles.between}>
      <View style={styles.flex}><Text style={styles.title}>{order.restaurant.name}</Text><Text style={styles.meta}>Pedido #{order.orderNumber}</Text></View>
      <View style={styles.amountBox}><Text style={styles.fee}>{moneyBob(order.deliveryFee)}</Text><Text style={styles.meta}>Tarifa de entrega</Text><Text style={styles.orderTotal}>Pedido {moneyBob(order.total)}</Text></View>
    </View>
    <RouteSummary order={order} />
    <View style={styles.itemsPreview}>
      <View style={styles.between}><Text style={styles.sectionLabel}>PRODUCTOS</Text><Text style={styles.meta}>{order.items.reduce((sum, item) => sum + item.quantity, 0)} productos</Text></View>
      {previewItems.length ? previewItems.map((item) => <View key={item.id} style={styles.itemLine}><Text style={styles.itemText} numberOfLines={1}>{item.quantity} × {item.productName}</Text><Text style={styles.itemPrice}>{moneyBob(item.subtotal)}</Text></View>) : <Text style={styles.meta}>Sin detalle de productos</Text>}
      {extraItems ? <Text style={styles.more}>+{extraItems} producto{extraItems === 1 ? "" : "s"} más</Text> : null}
    </View>
    <View style={styles.between}>
      <Text style={styles.meta}>{formatDistance(distanceKm(dashboard.location.position, orderPickup(order) ?? orderDestination(order)))} hasta la recogida</Text>
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
  const arrived = hasPickedUpOrder(order);
  const destination = activeOrderDestination(order);
  const destinationLabel = arrived ? "LLEVAR A" : "RECOGER EN";
  const destinationAddress = arrived
    ? order.customerAddress || "Dirección por confirmar"
    : order.restaurant.address || [order.restaurant.name, order.restaurant.city].filter(Boolean).join(", ");
  const destinationDetail = arrived ? order.deliveryAddressDetail : order.restaurant.addressReference;
  const cash = cashToCollect(order);
  return <View style={styles.active}>
    <View style={styles.mapDestination}>
      <MapPin size={21} color={C.teal} />
      <View style={styles.flex}>
        <Text style={styles.sectionLabel}>{destinationLabel}</Text>
        <Text style={styles.body}>{destinationAddress || "Ubicación por confirmar"}</Text>
        {destinationDetail ? <Text style={styles.meta}>{destinationDetail}</Text> : null}
        {!destination ? <Text style={styles.meta}>{arrived ? "Sin punto exacto guardado. Confirma la ubicación con el cliente." : "El local debe guardar su punto exacto de recogida."}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={arrived ? "Abrir ruta al cliente" : "Abrir ruta al local"} onPress={() => { void openActiveOrderMaps(order, dashboard.location.position); }} style={styles.routeButton}>
        <Navigation size={18} color={C.teal} /><Text style={styles.statusText}>Ver ruta</Text>
      </Pressable>
    </View>
    <View style={styles.map}>
      <LiveRiderMap currentLocation={dashboard.location.position} destination={destination} />
    </View>
    <View style={styles.between}>
      <View style={styles.flex}><Text style={styles.eyebrow}>PEDIDO #{order.orderNumber}</Text><Text style={styles.heading}>{arrived ? "Completa la entrega" : "Recoge el pedido"}</Text></View>
      <View style={styles.status}><Package size={18} color={C.teal} /><Text style={styles.statusText}>{arrived ? "Recogida" : "En curso"}</Text></View>
    </View>
    <View style={styles.progress}>
      {["Aceptada", "Recogida", "Entregada"].map((label, i) => <View key={label} style={styles.step}>
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
    {itemsOpen ? <View style={styles.items}>{order.items.map((item) => <View key={item.id} style={styles.item}><View style={styles.itemLine}><Text style={styles.body}>{item.quantity} × {item.productName}</Text><Text style={styles.itemPrice}>{moneyBob(item.subtotal)}</Text></View>{item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}</View>)}</View> : null}
    <View style={styles.between}><Text style={styles.meta}>Restaurante · {order.restaurant.name}</Text><ContactButton label="Contactar al restaurante" phone={order.restaurant.whatsapp} whatsapp /></View>
  </View>;
}

export function ActiveDeliveryActions({ order }: { order: MobileRiderOrder }) {
  const dashboard = useRiderDashboard();
  const [confirm, setConfirm] = useState<"arrived" | "delivered" | null>(null);
  const [confirmationCode, setConfirmationCode] = useState("");
  const arrived = hasPickedUpOrder(order);
  const cash = cashToCollect(order);
  const pending = dashboard.pending === "status";
  const blocked = Boolean(dashboard.pending) || Boolean(dashboard.error);
  const sanitizedCode = confirmationCode.replace(/\D/g, "").slice(0, 4);
  const modalTitle = confirm === "arrived" ? "Codigo del local" : "Codigo del cliente";
  const modalBody =
    confirm === "arrived"
      ? `Pide al local el codigo de recogida del pedido #${order.orderNumber}.`
      : cash > 0
        ? `Pide al cliente su codigo y confirma que cobraste ${moneyBob(cash)}.`
        : "Pide al cliente su codigo para cerrar la entrega.";
  const openConfirm = (nextStatus: "arrived" | "delivered") => {
    setConfirmationCode("");
    setConfirm(nextStatus);
  };
  const submitConfirmation = () => {
    if (!confirm || sanitizedCode.length !== 4) return;
    void dashboard.updateStatus(order, confirm, sanitizedCode).then((ok) => {
      if (ok) setConfirm(null);
    });
  };
  return <View style={styles.footer}>
    <PrimaryButton accessibilityLabel={arrived ? "Navegar al cliente" : "Navegar al local"} tone="dark" onPress={() => { void openActiveOrderMaps(order, dashboard.location.position); }}><Navigation size={21} color={C.white} /></PrimaryButton>
    <PrimaryButton style={styles.flex} loading={pending} disabled={blocked} onPress={() => openConfirm(arrived ? "delivered" : "arrived")}>
      <View style={styles.inline}><CheckCircle2 size={20} color={C.ink} /><Text style={styles.button}>{arrived ? "Confirmar entrega" : "Validar recogida"}</Text></View>
    </PrimaryButton>
    <Modal visible={Boolean(confirm)} transparent animationType="fade" onRequestClose={() => { if (!pending) setConfirm(null); }}>
      <View style={styles.scrim}><View accessibilityViewIsModal style={styles.modal}><ScrollView contentContainerStyle={styles.modalContent}>
        <KeyRound size={36} color={C.teal} />
        <Text style={styles.heading}>{modalTitle}</Text>
        <Text style={styles.body}>{modalBody}</Text>
        <TextInput
          accessibilityLabel={modalTitle}
          autoComplete="one-time-code"
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={(value) => setConfirmationCode(value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
          placeholderTextColor={C.muted}
          style={styles.codeInput}
          textAlign="center"
          value={sanitizedCode}
        />
        {dashboard.actionError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{dashboard.actionError}</Text> : null}
        <PrimaryButton disabled={blocked || sanitizedCode.length !== 4} loading={pending} onPress={submitConfirmation}><Text style={styles.button}>{confirm === "arrived" ? "Confirmar recogida" : "Confirmar entrega"}</Text></PrimaryButton>
        <PrimaryButton disabled={pending} tone="dark" onPress={() => setConfirm(null)}><Text style={[styles.button, { color: C.white }]}>Volver a la entrega</Text></PrimaryButton>
      </ScrollView></View></View>
    </Modal>
  </View>;
}

function RouteSummary({ order }: { order: MobileRiderOrder }) {
  return <View style={styles.route}>
    <View style={styles.routeRow}><Store size={19} color={C.orange} /><View style={styles.flex}><Text style={styles.sectionLabel}>RECOGIDA · #{order.orderNumber}</Text><Text style={styles.body}>{order.restaurant.name}</Text><Text style={styles.meta}>{order.restaurant.address || order.restaurant.city}</Text>{order.restaurant.addressReference ? <Text style={styles.meta}>{order.restaurant.addressReference}</Text> : null}</View></View>
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
  offer: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16, gap: 16 },
  active: { gap: 18 },
  amountBox: { alignItems: "flex-end", gap: 2 },
  eyebrow: { fontFamily: F.bold, fontSize: 11, color: C.teal },
  title: { fontFamily: F.semibold, fontSize: 17, color: C.ink },
  heading: { fontFamily: F.bold, fontSize: 22, color: C.ink },
  fee: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  orderTotal: { fontFamily: F.semibold, fontSize: 11, color: C.teal },
  meta: { fontFamily: F.regular, fontSize: 12, lineHeight: 18, color: C.muted, flexShrink: 1 },
  sectionLabel: { fontFamily: F.semibold, fontSize: 11, color: C.muted, marginBottom: 4 },
  body: { fontFamily: F.regular, fontSize: 14, lineHeight: 22, color: C.ink },
  button: { fontFamily: F.semibold, fontSize: 14, color: C.ink, flexShrink: 1, textAlign: "center" },
  route: { gap: 18, paddingVertical: 8 },
  routeRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  map: { height: 230, marginHorizontal: -18, backgroundColor: C.line },
  mapDestination: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeButton: { minHeight: 48, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", gap: 4 },
  footer: { flexDirection: "row", gap: 12, padding: 12, paddingHorizontal: 18, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.white, width: "100%", maxWidth: 720, alignSelf: "center" },
  status: { flexDirection: "row", gap: 6, alignItems: "center" },
  statusText: { color: C.teal, fontFamily: F.semibold, fontSize: 12 },
  progress: { flexDirection: "row", gap: 10 },
  step: { flex: 1, gap: 6 },
  stepBar: { height: 4, backgroundColor: C.line, borderRadius: 2 },
  section: { borderTopWidth: 1, borderColor: C.line, paddingTop: 18, gap: 8 },
  contact: { width: 48, height: 48, backgroundColor: "#E5F1ED", borderRadius: 18, alignItems: "center", justifyContent: "center" },
  note: { fontFamily: F.regular, fontSize: 14, lineHeight: 22, color: C.orange },
  payment: { backgroundColor: "#EBF0DC", flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", paddingVertical: 18, paddingHorizontal: 18, marginHorizontal: -18 },
  disclosure: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  itemsPreview: { backgroundColor: "#F4F7F5", borderRadius: 18, gap: 8, padding: 12 },
  itemLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  itemText: { flex: 1, fontFamily: F.regular, fontSize: 13, color: C.ink, lineHeight: 20 },
  itemPrice: { fontFamily: F.semibold, fontSize: 12, color: C.ink },
  more: { fontFamily: F.semibold, fontSize: 12, color: C.teal },
  items: { gap: 12 }, item: { borderBottomWidth: 1, borderColor: C.line, paddingBottom: 10 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.card, borderRadius: 18, width: "100%", maxWidth: 440, maxHeight: "90%" },
  modalContent: { padding: 24, gap: 18 },
  codeInput: { minHeight: 58, borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.white, color: C.ink, fontFamily: F.bold, fontSize: 28, letterSpacing: 10, paddingHorizontal: 16 },
  error: { color: C.red, fontSize: 13, fontFamily: F.regular },
});
