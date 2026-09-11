import type { MobileRiderOrder } from "./rider-api";

export type HistoryPeriod = "today" | "week" | "month" | "all";

export function boliviaDay(value: string | number | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  // Bolivia is UTC-4 year-round; use the business day, not the device timezone.
  return new Date(date.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function deliveryDate(order: MobileRiderOrder) {
  return order.dispatch?.deliveredAt ?? order.deliveredAt ?? order.createdAt;
}

export function isDelivered(order: MobileRiderOrder) {
  return order.dispatch?.status === "delivered" || order.status === "delivered";
}

export function isActiveDelivery(order: MobileRiderOrder) {
  return order.status !== "cancelled" && order.status !== "delivered" &&
    (order.dispatch?.status === "active" || order.dispatch?.status === "arrived");
}

export function inHistoryPeriod(value: string, period: HistoryPeriod, now = Date.now()) {
  const day = boliviaDay(value);
  const today = boliviaDay(now);
  if (!day || day > today) return false;
  if (period === "all") return true;
  if (period === "today") return day === today;
  const days = period === "week" ? 7 : 30;
  return day >= boliviaDay(now - (days - 1) * 86400000);
}

export function offerSeconds(expiresAt?: string | null, now = Date.now()) {
  if (!expiresAt) return null;
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) ? Math.max(0, Math.ceil((expires - now) / 1000)) : 0;
}

export function orderDestination(order: MobileRiderOrder) {
  const latitude = order.deliveryLatitude;
  const longitude = order.deliveryLongitude;
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function orderPickup(order: MobileRiderOrder) {
  const latitude = order.restaurant.latitude;
  const longitude = order.restaurant.longitude;
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function hasPickedUpOrder(order: MobileRiderOrder) {
  return order.dispatch?.status === "arrived" || Boolean(order.dispatch?.pickupCodeVerifiedAt);
}

export function activeOrderDestination(order: MobileRiderOrder) {
  return hasPickedUpOrder(order) ? orderDestination(order) : orderPickup(order);
}

export function cashToCollect(order: MobileRiderOrder) {
  return order.paymentMethod === "cash" && order.paymentStatus === "pending" ? order.total : 0;
}

export function validateRiderForm(input: { email: string; password: string; documentNumber: string; plateNumber: string }, mode: "login" | "register" | "google-link") {
  if (mode !== "google-link") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "Ingresa un correo válido.";
    if (!input.password) return "Ingresa tu contraseña.";
    if (mode === "register" && input.password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (mode !== "login" && (!input.documentNumber.trim() || !input.plateNumber.trim())) {
    return "Completa tu documento y la placa registrada en el restaurante.";
  }
  if (mode !== "login" && (input.documentNumber.trim().length < 4 || input.plateNumber.trim().length < 4)) return "El documento y la placa deben tener al menos 4 caracteres.";
  if (input.email.trim().length > 180 || input.password.length > 120 || input.documentNumber.trim().length > 40 || input.plateNumber.trim().length > 30) return "Revisa la longitud de los datos ingresados.";
  return "";
}
