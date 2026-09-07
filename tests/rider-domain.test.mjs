import { test } from "node:test";
import assert from "node:assert/strict";
import { boliviaDay, cashToCollect, inHistoryPeriod, isActiveDelivery, offerSeconds, orderDestination, validateRiderForm } from "../src/lib/rider-domain.ts";

test("Bolivia's business day does not advance at UTC midnight", () => {
  assert.equal(boliviaDay("2026-09-08T03:59:59Z"), "2026-09-07");
  assert.equal(boliviaDay("2026-09-08T04:00:00Z"), "2026-09-08");
  assert.equal(boliviaDay("invalid"), "");
});
test("7-day filter includes its first business day and excludes earlier/future days", () => {
  const now = Date.parse("2026-09-08T01:00:00Z");
  assert.equal(inHistoryPeriod("2026-09-01T04:00:00Z", "week", now), true);
  assert.equal(inHistoryPeriod("2026-09-01T03:59:59Z", "week", now), false);
  assert.equal(inHistoryPeriod("2026-09-08T04:00:00Z", "week", now), false);
  assert.equal(inHistoryPeriod("2026-09-08T03:00:00Z", "today", now), true);
});
test("expired or malformed offers are never actionable", () => {
  const now = Date.parse("2026-09-07T12:00:00Z");
  assert.equal(offerSeconds("2026-09-07T12:00:01Z", now), 1);
  assert.equal(offerSeconds("2026-09-07T12:00:00Z", now), 0);
  assert.equal(offerSeconds("invalid", now), 0);
  assert.equal(offerSeconds(null, now), null);
});
test("cash collection never double-charges prepaid, refunded or non-cash orders", () => {
  const base = { paymentMethod: "cash", paymentStatus: "pending", total: 87 };
  assert.equal(cashToCollect(base), 87);
  for (const paymentStatus of ["paid", "refunded", "cancelled"]) assert.equal(cashToCollect({ ...base, paymentStatus }), 0);
  assert.equal(cashToCollect({ ...base, paymentMethod: "qr" }), 0);
});
test("remote cancellation and delivery supersede an old active dispatch", () => {
  assert.equal(isActiveDelivery({ status: "ready", dispatch: { status: "active" } }), true);
  assert.equal(isActiveDelivery({ status: "ready", dispatch: { status: "arrived" } }), true);
  for (const status of ["cancelled", "delivered"]) assert.equal(isActiveDelivery({ status, dispatch: { status: "active" } }), false);
});
test("map coordinates reject missing, nonfinite and out-of-range values", () => {
  assert.deepEqual(orderDestination({ deliveryLatitude: 0, deliveryLongitude: 0 }), { latitude: 0, longitude: 0 });
  for (const deliveryLatitude of [null, NaN, 91]) assert.equal(orderDestination({ deliveryLatitude, deliveryLongitude: -66 }), null);
});
test("onboarding validates before sending credentials and follows registration limits", () => {
  const valid = { email: "rider@example.test", password: "password123", documentNumber: "1234567", plateNumber: "1234ABC" };
  assert.equal(validateRiderForm(valid, "register"), "");
  assert.ok(validateRiderForm({ ...valid, email: "invalid" }, "login"));
  assert.ok(validateRiderForm({ ...valid, password: "short" }, "register"));
  assert.ok(validateRiderForm({ ...valid, documentNumber: "1" }, "register"));
  assert.equal(validateRiderForm({ ...valid, email: "", password: "" }, "google-link"), "");
});
