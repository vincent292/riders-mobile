# Yopido Riders

Aplicación Android para los repartidores vinculados a `yopido.shop`. Expo SDK 57,
React Native y Expo Router. El servidor conserva la autoridad sobre ofertas,
disponibilidad, afiliaciones y estados de entrega.

## Desarrollo

1. Instalar Node compatible con Expo 57 (22.13 o posterior) y ejecutar `npm ci`.
2. Configurar `.env.local` tomando `.env.example` como referencia.
3. Ejecutar `npm start` para Metro o `npm run android` con un dispositivo conectado.
4. Para revisar la presentación en navegador, ejecutar `npm run web`.

Variables de integración:

- `EXPO_PUBLIC_API_BASE_URL`: servidor de Yopido, por defecto `https://yopido.shop`.
- `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: autenticación
  con Google y actualización de ubicación mediante RPC. Se admite la clave anon
  pública como alternativa. Nunca usar una service-role key en la app.
- `EXPO_PUBLIC_AUTH_REDIRECT_URI`: callback autorizado en Supabase; esquema nativo
  `ridersmobile://auth/callback`.
- `GOOGLE_MAPS_ANDROID_API_KEY`: clave de Maps restringida al paquete
  `shop.yopido.riders` y al certificado de firma de Android.
- `GOOGLE_SERVICES_JSON`: ruta al archivo Firebase; también se admite
  `./google-services.json`. No se versiona.

## Flujo Del Rider

- El registro requiere correo, documento y placa previamente aprobados por un restaurante.
- El permiso de ubicación se solicita al comenzar el turno, no al consultar perfil o historial.
- Las ofertas tienen cuenta regresiva. Una acción en curso bloquea las demás y se
  reconcilia con el servidor antes de permitir otra operación.
- Durante una entrega se puede navegar al cliente, llamar, contactar por WhatsApp,
  revisar productos y consultar el importe pendiente en efectivo.
- La entrega se finaliza con confirmación explícita después de marcar llegada.
- El historial usa el día de Bolivia (UTC-4), filtros de hoy/7 días/30 días/todo y búsqueda.
- Las tarifas de envío no se presentan como un saldo liquidado. La API actual no
  expone liquidaciones, comisiones ni retiro de fondos.

## Ubicación Y Avisos

El mapa nativo encuadra rider y destino. La línea punteada indica referencia
directa, no una ruta vial calculada. Google Maps ofrece la navegación vial.
El cliente móvil no dispone de coordenadas de recogida en el contrato actual.
El destino y el botón «Ver ruta» aparecen antes del mapa, incluso sin GPS.
La vista web muestra el destino en un mapa incrustado de OpenStreetMap.
Al aceptar una entrega se solicita y publica una posición inicial sin esperar
a que el rider se desplace; el servicio en segundo plano no bloquea esa lectura.

Si Android muestra el logotipo de Google pero no las calles, comprobar la conexión
y la autorización de Maps: habilitar Maps SDK for Android y la facturación en el
proyecto de la clave, y autorizar `shop.yopido.riders` junto con el SHA-1 del
certificado que firma esa instalación (debug, EAS o Google Play). Una clave
presente en el manifiesto no demuestra que Google la acepte. Revisar los errores
de Google Maps en `adb logcat` con el teléfono conectado. Los cambios de clave
requieren regenerar Android con `npx expo prebuild --platform android` y compilar
e instalar de nuevo; recargar la URL de Metro no cambia la configuración nativa.

En Android instalado, el rider puede activar ubicación al salir de la app desde
una entrega. Antes del permiso se explica su uso. Expo TaskManager ejecuta un
servicio con notificación visible; valida la entrega con el servidor y publica
la muestra más reciente. Se detiene al finalizar/cancelarse la entrega, al salir
de la cuenta o al expirar su límite de 12 horas. No mantiene un historial local
de posiciones. Una pérdida de conexión se recupera con la siguiente muestra.

Los pedidos no se marcan entregados sin confirmación del servidor. No se encolan
automáticamente aceptaciones o cambios de estado porque pueden haber vencido o
haberse completado en otro dispositivo. Las lecturas reintentan una vez; las
mutaciones se reconcilian antes de ofrecer un nuevo intento.

El seguimiento en segundo plano requiere una compilación Android con permisos
y módulos nativos de ubicación; no depende de Firebase. Las notificaciones usan
`expo-notifications` y un Expo Push Token enviado al servidor. En Android,
Expo Push depende de Firebase FCM: se necesita `google-services.json` para
`shop.yopido.riders` y una cuenta de servicio FCM V1 configurada en EAS.
La ausencia del SDK JavaScript de Firebase no significa que no se utilice FCM.
Expo Go y la vista web no verifican estas funciones. Android puede detener el servicio si se fuerza
el cierre de la app o por restricciones del fabricante.

## Verificación

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npx expo export --platform android --output-dir dist/android
```

Las pruebas E2E usan únicamente respuestas simuladas; bloquean solicitudes
externas y no crean ni actualizan pedidos reales. Cubren acceso, disponibilidad,
entrega, historial y pérdida de conexión en 360 px, 412 px y escritorio. Usan
Edge si está instalado en Windows; en otros equipos ejecutar primero
`npx playwright install chromium`. Capturas y trazas quedan en `test-results/`.

Antes de publicar un APK, verificar en Android físico:

- Permitir/denegar ubicación, desactivar GPS y volver desde Ajustes.
- Recibir una oferta con la app abierta, en segundo plano y al tocar el aviso.
- Abrir Maps y bloquear la pantalla durante una entrega, verificando la ubicación en Yopido.
- Cortar/restablecer datos móviles, comprobar que una acción no se duplica.
- Finalizar/cancelar una entrega y confirmar que se detiene el servicio de ubicación.
- Probar sesión vencida, Google OAuth, afiliación vencida y permisos revocados.
- Revisar tamaños de fuente grandes y navegación con gestos/botones de Android.

## Compilación

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

`preview` genera un APK interno; `production`, un Android App Bundle.
Configurar las variables de EAS y Firebase antes de compilar. La exportación
Hermes valida el código JavaScript Android, pero no sustituye una compilación
nativa ni una prueba en dispositivo. Este repositorio no despliega el servidor.

## Organización

- `src/context/rider-dashboard.tsx`: disponibilidad, pedidos, bloqueo de acciones y sincronización.
- `src/hooks/use-live-rider-location.ts`: ubicación visible y ciclo del seguimiento.
- `src/lib/background-location.native.ts`: tarea y servicio de ubicación Android.
- `src/components/delivery-card.tsx`: oferta, entrega activa y confirmación.
- `src/components/rider-notifications.tsx`: permiso, registro push y apertura de ofertas.
- `src/lib/rider-domain.ts`: reglas de fechas, ofertas, cobros y validación.
- `src/lib/rider-api.ts`: contrato con Yopido, tiempos de espera y errores.

Referencia de APIs nativas: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
