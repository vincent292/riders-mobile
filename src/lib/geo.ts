export type Coordinates = {
  latitude: number;
  longitude: number;
};

const earthRadiusKm = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKm(from?: Coordinates | null, to?: Coordinates | null) {
  if (!from || !to) return null;

  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function formatDistance(value: number | null) {
  if (value == null || Number.isNaN(value)) return "-- km";
  if (value < 1) return `${Math.max(100, Math.round(value * 1000))} m`;
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}

export function estimateEtaMinutes(value: number | null) {
  if (value == null || Number.isNaN(value)) return "-- min";
  return `${Math.max(8, Math.round(value * 4 + 6))} min`;
}

export function googleDirectionsUrl(destination: Coordinates | string, origin?: Coordinates | null) {
  const destinationValue =
    typeof destination === "string"
      ? destination
      : `${destination.latitude.toFixed(7)},${destination.longitude.toFixed(7)}`;
  const params = new URLSearchParams({
    api: "1",
    destination: destinationValue,
    travelmode: "driving",
  });

  if (origin) {
    params.set("origin", `${origin.latitude.toFixed(7)},${origin.longitude.toFixed(7)}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function moneyBob(value: number) {
  return `Bs ${value.toFixed(2)}`;
}

export function shortTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-BO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/La_Paz",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function shortDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-BO", {
      day: "2-digit",
      month: "short",
      timeZone: "America/La_Paz",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
