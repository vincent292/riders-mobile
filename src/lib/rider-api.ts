import { config } from "./config";

const apiTimeoutMs = 20000;

export class RiderApiError extends Error {
  code: string;
  status?: number;
  url?: string;
  causeMessage?: string;

  constructor(code: string, options: { causeMessage?: string; status?: number; url?: string } = {}) {
    super(code);
    this.name = "RiderApiError";
    this.code = code;
    this.status = options.status;
    this.url = options.url;
    this.causeMessage = options.causeMessage;
  }
}

export type MobileRider = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantCity: string;
  restaurantLogoUrl: string;
  restaurantWhatsapp: string;
  fullName: string;
  email: string;
  phone: string;
  plateNumber: string;
  status: "active" | "suspended" | "expired";
  membershipAmount: number;
  membershipCurrency: string;
  membershipStartedAt: string;
  membershipValidUntil: string;
  approvedAt: string;
};

export type MobileRiderOrder = {
  id: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    city: string;
    logoUrl: string;
    whatsapp: string;
  };
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryAddressDetail: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryMapsUrl: string;
  requestedFulfillmentAt: string | null;
  status: "pending" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "cancelled" | "refunded";
  paymentMethod: "cash" | "qr" | "bank_transfer" | "card" | "other";
  subtotal: number;
  deliveryFee: number;
  discountTotal: number;
  total: number;
  notes: string;
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string;
  createdAt: string;
  dispatch: {
    id: string;
    riderId: string | null;
    status: "active" | "arrived" | "delivered" | "cancelled" | "expired";
    deliveryPhone: string;
    deliveryName: string;
    openedAt: string | null;
    arrivedAt: string | null;
    deliveredAt: string | null;
    expiresAt: string;
    createdAt: string;
    riderLocation: {
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      heading: number | null;
      speedMetersPerSecond: number | null;
      updatedAt: string;
    } | null;
  } | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    notes: string;
  }[];
};

export type RiderSessionPayload = {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
  };
  riders: MobileRider[];
  activeRiders?: MobileRider[];
  availableToday?: boolean;
};

export type RiderMePayload = {
  user: {
    id: string;
    email: string;
  };
  riders: MobileRider[];
  activeRiders: MobileRider[];
  availableToday: boolean;
  updatedAt: string;
};

export type RiderOrdersPayload = {
  orders: MobileRiderOrder[];
  scope: "available" | "mine" | "history";
  updatedAt: string;
};

export type MobileRiderOffer = {
  id: string;
  orderId: string;
  restaurantId: string;
  restaurantRiderId: string;
  status: "pending";
  expiresAt: string;
  createdAt: string;
  distanceKm: number | null;
  order: MobileRiderOrder;
};

export type RiderOffersPayload = {
  offers: MobileRiderOffer[];
  updatedAt: string;
};

export type RiderDashboardPayload = {
  available: MobileRiderOrder[];
  mine: MobileRiderOrder[];
  offers: MobileRiderOffer[];
  updatedAt: string;
};

export type RiderAvailabilityPayload = {
  activeRiders: MobileRider[];
  available: boolean;
  updatedAt: string;
};

export type RiderPushRegistrationPayload = {
  ok: true;
};

function apiUrl(path: string) {
  if (!config.apiBaseUrl) throw new RiderApiError("api-base-url-required");
  return `${config.apiBaseUrl.replace(/\/$/, "")}${path}`;
}

function errorCodeFromBody(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }

  return fallback;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function riderApi<T>(path: string, init: RequestInit, fallbackCode = "rider-api-failed"): Promise<T> {
  const url = apiUrl(path);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => {
        controller.abort();
      }, apiTimeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller?.signal,
    });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    throw new RiderApiError(isAbort ? "api-timeout" : "api-network-failed", {
      causeMessage: error instanceof Error ? error.message : String(error),
      url,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const code = response.status === 404 && !errorCodeFromBody(data, "")
      ? "rider-api-not-deployed"
      : errorCodeFromBody(data, fallbackCode);
    throw new RiderApiError(code, { status: response.status, url });
  }

  return data as T;
}

export function riderErrorMessage(error: unknown) {
  const code = error instanceof RiderApiError ? error.code : error instanceof Error ? error.message : "rider-api-failed";
  if (code === "api-network-failed") return "No pudimos conectar con el SaaS. Usa una URL publica o una IP/tunel accesible desde el celular.";
  if (code === "api-timeout") return "El SaaS tardo demasiado en responder.";
  if (code === "api-base-url-required") return "Configura EXPO_PUBLIC_API_BASE_URL.";
  if (code === "rider-api-not-deployed") return "La API de riders no esta desplegada en esa URL.";
  if (code === "invalid-rider-credentials") return "Correo o contrasena incorrectos.";
  if (code === "invalid-rider-login") return "Revisa correo y contrasena.";
  if (code === "invalid-rider-register") return "Revisa correo, contrasena, carnet y placa.";
  if (code === "approved-rider-not-found") return "No encontramos un rider aprobado con ese correo, carnet y placa.";
  if (code === "rider-membership-expired") return "Tu membresia de rider vencio.";
  if (code === "rider-membership-inactive") return "Tu rider no tiene una membresia activa.";
  if (code === "rider-account-not-linked") return "Tu cuenta todavia no esta vinculada a un rider aprobado.";
  if (code === "rider-account-already-linked") return "Ese rider ya esta vinculado a otra cuenta.";
  if (code === "invalid-rider-availability") return "No pudimos actualizar tu disponibilidad.";
  if (code === "rider-availability-failed") return "No pudimos guardar tu turno activo.";
  if (code === "email-already-exists") return "Ese correo ya tiene una cuenta.";
  if (code === "order-not-available") return "La carrera ya no esta disponible.";
  if (code === "order-already-assigned") return "La carrera ya fue asignada a otro rider.";
  if (code === "order-already-delivered") return "El pedido ya fue entregado.";
  if (code === "order-already-offered") return "Esta carrera esta ofrecida a otro rider.";
  if (code === "rider-dispatch-not-found") return "No encontramos esta carrera activa en tu cuenta.";
  if (code === "rider-offer-not-found") return "La oferta ya vencio o fue tomada.";
  if (code === "rider-offers-failed") return "No pudimos leer tus ofertas nuevas.";
  if (code === "invalid-rider-location") return "No pudimos leer una ubicacion valida.";
  if (code === "rider-location-failed") return "No pudimos enviar tu ubicacion al cliente.";
  if (code === "unauthorized") return "Tu sesion vencio. Vuelve a ingresar.";
  if (code === "google-not-configured") return "Faltan las variables publicas de Supabase para usar Google.";
  if (code === "google-cancelled") return "Ingreso con Google cancelado.";
  if (code === "google-rider-link-required") return "Google ingreso bien. Vincula tu carnet y placa para activar el rider.";
  return `No se pudo completar la accion (${code}).`;
}

export async function loginRider(input: { email: string; password: string }) {
  return riderApi<RiderSessionPayload>("/api/mobile/riders/login", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function registerRider(input: {
  email: string;
  password: string;
  documentNumber: string;
  plateNumber: string;
}) {
  return riderApi<RiderSessionPayload>("/api/mobile/riders/register", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function fetchRiderMe(accessToken: string) {
  return riderApi<RiderMePayload>("/api/mobile/riders/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "GET",
  });
}

export async function linkGoogleRider(
  accessToken: string,
  input: {
    documentNumber: string;
    plateNumber: string;
  },
) {
  return riderApi<{ user: RiderSessionPayload["user"]; riders: MobileRider[] }>("/api/mobile/riders/google-link", {
    body: JSON.stringify(input),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function listRiderOrders(accessToken: string, scope: "available" | "mine" | "history") {
  return riderApi<RiderOrdersPayload>(`/api/mobile/riders/orders?scope=${encodeURIComponent(scope)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "GET",
  });
}

export async function listRiderOffers(accessToken: string) {
  return riderApi<RiderOffersPayload>("/api/mobile/riders/offers", {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "GET",
  });
}

export async function fetchRiderDashboard(accessToken: string, includeAvailable: boolean) {
  return riderApi<RiderDashboardPayload>(`/api/mobile/riders/dashboard?includeAvailable=${includeAvailable}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "GET",
  });
}

export async function updateRiderAvailability(
  accessToken: string,
  input: {
    accuracyMeters?: number | null;
    heading?: number | null;
    isAvailable: boolean;
    latitude?: number | null;
    longitude?: number | null;
    speedMetersPerSecond?: number | null;
  },
) {
  return riderApi<RiderAvailabilityPayload>("/api/mobile/riders/availability", {
    body: JSON.stringify(input),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function registerRiderPushToken(
  accessToken: string,
  input: {
    appVersion?: string;
    deviceId?: string;
    expoPushToken: string;
    platform?: string;
    riderId?: string;
  },
) {
  return riderApi<RiderPushRegistrationPayload>("/api/mobile/riders/push/register", {
    body: JSON.stringify(input),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function acceptRiderOrder(accessToken: string, orderId: string) {
  return riderApi<{ order: MobileRiderOrder }>(`/api/mobile/riders/orders/${encodeURIComponent(orderId)}/accept`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "POST",
  });
}

export async function acceptRiderOffer(accessToken: string, offerId: string) {
  return riderApi<{ order: MobileRiderOrder }>(`/api/mobile/riders/offers/${encodeURIComponent(offerId)}/accept`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "POST",
  });
}

export async function rejectRiderOffer(accessToken: string, offerId: string, reason = "rider-rejected") {
  return riderApi<{ next: unknown; orderId: string }>(`/api/mobile/riders/offers/${encodeURIComponent(offerId)}/reject`, {
    body: JSON.stringify({ reason }),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function updateRiderOrderStatus(accessToken: string, orderId: string, status: "arrived" | "delivered") {
  return riderApi<{ order: MobileRiderOrder; status: "arrived" | "delivered" }>(
    `/api/mobile/riders/orders/${encodeURIComponent(orderId)}/status`,
    {
      body: JSON.stringify({ status }),
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      method: "POST",
    },
  );
}

export async function updateRiderLocation(
  accessToken: string,
  orderId: string,
  input: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    heading?: number | null;
    speedMetersPerSecond?: number | null;
  },
) {
  if (config.supabaseUrl && config.supabasePublishableKey) {
    try {
      await updateRiderLocationViaSupabaseRpc(accessToken, orderId, input);
      return { updatedAt: new Date().toISOString() };
    } catch (error) {
      if (!(error instanceof RiderApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  return riderApi<{ updatedAt: string }>(`/api/mobile/riders/orders/${encodeURIComponent(orderId)}/location`, {
    body: JSON.stringify(input),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
}

async function updateRiderLocationViaSupabaseRpc(
  accessToken: string,
  orderId: string,
  input: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    heading?: number | null;
    speedMetersPerSecond?: number | null;
  },
) {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new RiderApiError("rider-location-failed");
  }

  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/update_rider_live_location`, {
    body: JSON.stringify({
      p_accuracy_meters: input.accuracyMeters ?? null,
      p_heading: input.heading ?? null,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_order_id: orderId,
      p_speed_mps: input.speedMetersPerSecond ?? null,
    }),
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new RiderApiError("rider-location-failed", { status: response.status });
  }
}
