import * as Location from "expo-location";
import { RiderApiError } from "./rider-api";

export async function getRiderPosition(requestPermission = false) {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && requestPermission && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new RiderApiError("location-permission-denied");
  if (!(await Location.hasServicesEnabledAsync())) throw new RiderApiError("location-services-disabled");
  return new Promise<Location.LocationObject>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new RiderApiError("location-timeout")), 15000);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true })
      .then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

export function locationMessage(error: unknown) {
  if (error instanceof RiderApiError) {
    if (error.code === "location-permission-denied") return "Permiso de ubicación pendiente";
    if (error.code === "location-services-disabled") return "Activa el GPS del teléfono";
    if (error.code === "location-timeout") return "GPS sin señal. Acércate a un lugar abierto";
  }
  return "No se pudo obtener tu ubicación";
}
