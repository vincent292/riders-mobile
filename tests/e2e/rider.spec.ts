import { test, expect, type Page } from "@playwright/test";

async function mockApi(page: Page, mode: "available" | "offline" | "expired" = "available") {
  const now = Date.now();
  const restaurant = { id: "test-restaurant", name: "La Esquina · Cocina y Hamburguesas", city: "Cochabamba", whatsapp: "", slug: "test", logoUrl: "" };
  const rider = { id: "test-rider", restaurantId: restaurant.id, restaurantName: restaurant.name, restaurantCity: restaurant.city, restaurantWhatsapp: "", fullName: "Daniel Rivera", plateNumber: "1234ABC", status: "active", membershipValidUntil: new Date(now + 5 * 86400000).toISOString(), phone: "70000000" };
  let available = mode !== "offline";
  let active = false;
  let delivered = false;
  let arrived = false;
  let rejectFails = false;
  let meOffline = false;
  let dashboardOffline = false;
  let accepts = 0;
  let loseAcceptResponse = false;
  const order = { id: "test-order", orderNumber: "2048", restaurant, customerName: "María Fernanda", customerPhone: "70000001", customerAddress: "Av. América, edificio Las Palmas, departamento 402", deliveryAddressDetail: "Portón verde, llamar al llegar", deliveryLatitude: -17.375, deliveryLongitude: -66.14, deliveryMapsUrl: "", deliveryFee: 12, total: 87, paymentStatus: "pending", paymentMethod: "cash", notes: "Entregar en recepción. No tocar el timbre.", status: "ready", createdAt: new Date(now).toISOString(), deliveredAt: null, dispatch: null, items: [{ id: "item", quantity: 2, productName: "Hamburguesa de la casa", unitPrice: 37.5, subtotal: 75, notes: "Sin cebolla" }] };
  const historical = { ...order, id: "historical", orderNumber: "2001", status: "delivered", dispatch: { status: "delivered", deliveredAt: new Date(now).toISOString() } };
  const current = () => ({ ...order, status: delivered ? "delivered" : "ready", dispatch: { status: delivered ? "delivered" : arrived ? "arrived" : "active", deliveredAt: delivered ? new Date().toISOString() : null } });
  const me = () => ({ user: { id: "test-user", email: "rider@example.test" }, riders: [rider], activeRiders: [rider], availableToday: available });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "www.openstreetmap.org" && url.pathname === "/export/embed.html") {
      return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Mapa simulado</title>" });
    }
    if (url.pathname.startsWith("/api/mobile/riders/")) {
      const path = url.pathname;
      const fulfill = (json: unknown, status = 200) => route.fulfill({ status, json });
      if (path.endsWith("/login")) return fulfill({ ...me(), accessToken: "test-only-token" });
      if (path.endsWith("/me")) return meOffline ? route.abort() : fulfill(me());
      if (path.endsWith("/dashboard")) {
        if (dashboardOffline) return route.abort();
        return fulfill({ available: [], mine: active ? [current()] : [], offers: available && !active && !delivered ? [{ id: "test-offer", orderId: order.id, order, expiresAt: new Date(mode === "expired" ? now - 1000 : now + 300000).toISOString() }] : [] });
      }
      if (path.endsWith("/availability")) { available = route.request().postDataJSON().isAvailable; return fulfill({ available, activeRiders: [rider] }); }
      if (path.endsWith("/accept")) { accepts++; await new Promise((resolve) => setTimeout(resolve, 250)); active = true; return loseAcceptResponse ? route.abort() : fulfill({ order: current() }); }
      if (path.endsWith("/reject")) { if (rejectFails) return fulfill({ error: "rider-api-failed" }, 500); delivered = true; return fulfill({ orderId: order.id }); }
      if (path.endsWith("/status")) { arrived = true; delivered = route.request().postDataJSON().status === "delivered"; return fulfill({ order: current() }); }
      if (path.endsWith("/orders")) return fulfill({ orders: [historical, ...(delivered && active ? [current()] : [])] });
      return fulfill({ updatedAt: new Date().toISOString() });
    }
    if (["localhost", "127.0.0.1"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    return route.abort();
  });
  return { accepts: () => accepts, loseAcceptResponse: () => { loseAcceptResponse = true; }, failReject: () => { rejectFails = true; }, loseConnection: () => { meOffline = true; dashboardOffline = true; }, restoreConnection: () => { meOffline = false; dashboardOffline = false; } };
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Correo", exact: true }).fill("rider@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Hola, Daniel", { exact: true })).toBeVisible();
}

async function layoutCheck(page: Page) {
  const overflow = await page.evaluate(() => [...document.querySelectorAll("button, input, [role=button]")].filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
  }).map((element) => element.textContent));
  expect(overflow).toEqual([]);
}

test("login validation, shift, delivery confirmation and history", async ({ page }, testInfo) => {
  const api = await mockApi(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Ingresa un correo válido.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("login.png") });
  await login(page);
  await expect(page.getByRole("button", { name: "Aceptar entrega" })).toBeVisible();
  await layoutCheck(page);
  await page.screenshot({ path: testInfo.outputPath("offers.png") });
  await page.getByRole("button", { name: "Aceptar entrega" }).dblclick();
  await expect(page.getByText("Tu entrega en curso")).toBeVisible();
  expect(api.accepts()).toBe(1);
  await expect(page.getByText("COBRAR EN EFECTIVO")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("active.png") });
  await page.getByRole("button", { name: "Llegué al cliente" }).click();
  await expect(page.getByText("Completa la entrega")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar entrega", exact: true }).click();
  await expect(page.getByText("¿Pedido entregado?")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("confirmation.png") });
  await page.getByRole("button", { name: "Volver a la entrega" }).click();
  await expect(page.getByText("Completa la entrega")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar entrega", exact: true }).click();
  await page.getByRole("button", { name: "Sí, pedido entregado" }).click();
  await expect(page.getByText("Buscando tu próxima entrega")).toBeVisible();
  await page.getByText("Historial", { exact: true }).click();
  await expect(page.getByText("2 entregas completadas")).toBeVisible();
  await page.getByRole("tab", { name: "Hoy", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar pedido o restaurante" }).fill("2001");
  await expect(page.getByText("1 entregas completadas")).toBeVisible();
  await layoutCheck(page);
  await page.screenshot({ path: testInfo.outputPath("history.png") });
  await page.getByText("Perfil", { exact: true }).click();
  await expect(page.getByText("Mis restaurantes", { exact: true })).toBeVisible();
  await layoutCheck(page);
  await page.screenshot({ path: testInfo.outputPath("profile.png") });
  expect(errors).toEqual([]);
});

test("connection loss preserves sign-in and failed rejection keeps offer visible", async ({ page }) => {
  const api = await mockApi(page);
  await login(page);
  api.failReject();
  await page.getByRole("button", { name: "Rechazar oferta" }).click();
  await expect(page.getByRole("button", { name: "Aceptar entrega" })).toBeEnabled();
  api.loseConnection();
  await page.reload();
  await expect(page.getByText("Hola, Daniel", { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Sin conexión con Yopido/)).toBeVisible();
  api.restoreConnection();
  await page.getByRole("button", { name: "Actualizar pedidos" }).click();
  await expect(page.getByRole("button", { name: "Aceptar entrega" })).toBeEnabled();
});

test("inactive riders can start a shift", async ({ page }, testInfo) => {
  await mockApi(page, "offline");
  await login(page);
  await expect(page.getByRole("button", { name: "Comenzar turno" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("off-shift.png") });
  await page.getByRole("button", { name: "Comenzar turno" }).click();
  await expect(page.getByRole("button", { name: "Aceptar entrega" })).toBeVisible();
});

test("expired offers cannot be accepted", async ({ page }) => {
  await mockApi(page, "expired");
  await login(page);
  await expect(page.getByText("Buscando tu próxima entrega")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceptar entrega" })).toHaveCount(0);
});

test("lost acceptance response reconciles the active order without resubmitting", async ({ page }) => {
  const api = await mockApi(page);
  await login(page);
  api.loseAcceptResponse();
  await page.getByRole("button", { name: "Aceptar entrega" }).click();
  await expect(page.getByText("Tu entrega en curso")).toBeVisible();
  await expect(page.getByRole("button", { name: "Llegué al cliente" })).toBeEnabled();
  expect(api.accepts()).toBe(1);
});

test("acceptance publishes a location even when the position watcher stays silent", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, "watchPosition", { configurable: true, value: () => 1 });
    Object.defineProperty(navigator.geolocation, "clearWatch", { configurable: true, value: () => {} });
  });
  await login(page);
  const shared = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/orders/test-order/location"));
  await page.getByRole("button", { name: "Aceptar entrega" }).click();
  const request = await shared;
  expect(request.postDataJSON()).toMatchObject({ latitude: -17.3895, longitude: -66.1568 });
  await expect(page.getByText("Ubicación compartida", { exact: true })).toBeVisible();
});

test("accepted delivery shows its destination and navigation without GPS permission", async ({ page, context }) => {
  await context.clearPermissions();
  await context.grantPermissions([]);
  await mockApi(page);
  await login(page);
  await page.getByRole("button", { name: "Aceptar entrega" }).click();
  await expect(page.getByText("LLEVAR A", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir ruta al cliente" })).toBeVisible();
  const map = page.locator('iframe[title="Mapa del destino de entrega"]');
  await expect(map).toBeVisible();
  const source = new URL((await map.getAttribute("src"))!);
  expect(source.searchParams.get("marker")).toBe("-17.375,-66.14");
  await layoutCheck(page);
});
