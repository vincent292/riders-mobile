type RiderOrdersListener = () => void;

const orderListeners = new Set<RiderOrdersListener>();

export function notifyRiderOrdersChanged() {
  orderListeners.forEach((listener) => listener());
}

export function subscribeToRiderOrderChanges(listener: RiderOrdersListener) {
  orderListeners.add(listener);
  return () => orderListeners.delete(listener);
}
