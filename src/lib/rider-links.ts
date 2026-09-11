import { Alert, Linking } from "react-native";
import { googleDirectionsUrl, type Coordinates } from "./geo";
import { activeOrderDestination, hasPickedUpOrder, orderDestination, orderPickup } from "./rider-domain";
import type { MobileRiderOrder } from "./rider-api";

export async function openRiderLink(url: string) {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:", "tel:", "mailto:"].includes(parsed.protocol)) throw new Error("unsupported-link");
    await Linking.openURL(url);
  } catch {
    Alert.alert("No se pudo abrir", "Revisa que tengas una aplicación compatible e inténtalo nuevamente.");
  }
}

export function openDeliveryMaps(order: MobileRiderOrder, origin?: Coordinates | null) {
  const destination = orderDestination(order);
  if (destination) return openRiderLink(googleDirectionsUrl(destination, origin));
  if (order.deliveryMapsUrl && /^https:\/\//i.test(order.deliveryMapsUrl)) return openRiderLink(order.deliveryMapsUrl);
  if (order.customerAddress.trim()) return openRiderLink(googleDirectionsUrl(order.customerAddress));
  Alert.alert("Dirección pendiente", "Contacta al cliente o al restaurante para confirmar el destino.");
}

export function openPickupMaps(order: MobileRiderOrder, origin?: Coordinates | null) {
  const pickup = orderPickup(order);
  if (pickup) return openRiderLink(googleDirectionsUrl(pickup, origin));
  if (order.restaurant.mapsUrl && /^https:\/\//i.test(order.restaurant.mapsUrl)) return openRiderLink(order.restaurant.mapsUrl);
  const address = [order.restaurant.address, order.restaurant.city].filter(Boolean).join(", ");
  if (address) return openRiderLink(googleDirectionsUrl(address));
  if (order.restaurant.name.trim()) return openRiderLink(googleDirectionsUrl(`${order.restaurant.name}, ${order.restaurant.city}`));
  Alert.alert("Ubicación pendiente", "El local todavía no tiene una ubicación de recogida configurada.");
}

export function openActiveOrderMaps(order: MobileRiderOrder, origin?: Coordinates | null) {
  const destination = activeOrderDestination(order);
  if (destination) return openRiderLink(googleDirectionsUrl(destination, origin));
  return hasPickedUpOrder(order) ? openDeliveryMaps(order, origin) : openPickupMaps(order, origin);
}

export function contactPhone(phone: string, whatsapp = false, message = "") {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 8) digits = `591${digits}`;
  if (digits.length < 8) {
    Alert.alert("Contacto no disponible", "El teléfono registrado está incompleto.");
    return;
  }
  void openRiderLink(whatsapp ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `tel:+${digits}`);
}
