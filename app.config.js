const fs = require("node:fs");

module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  const iosGoogleMapsApiKey =
    process.env.GOOGLE_MAPS_IOS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ||
    "";
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync("./google-services.json") ? "./google-services.json" : "");
  const plugins = [...(config.plugins ?? [])];

  if (!plugins.some((plugin) => Array.isArray(plugin) ? plugin[0] === "expo-location" : plugin === "expo-location")) {
    plugins.push([
      "expo-location",
      {
        locationWhenInUsePermission: "Permite que Yopido Riders use tu ubicacion durante la entrega.",
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ]);
  }

  if (!plugins.some((plugin) => Array.isArray(plugin) ? plugin[0] === "expo-notifications" : plugin === "expo-notifications")) {
    plugins.push([
      "expo-notifications",
      {
        color: "#C7F000",
        defaultChannel: "rider-dispatch",
        icon: "./assets/expo.icon/Generated/monochrome-symbol.png",
      },
    ]);
  }

  const mapsPluginIndex = plugins.findIndex((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-maps");
  if (mapsPluginIndex >= 0) {
    const plugin = plugins[mapsPluginIndex];
    plugins[mapsPluginIndex] = [
      "react-native-maps",
      {
        ...(plugin[1] ?? {}),
        ...(googleMapsApiKey ? { androidGoogleMapsApiKey: googleMapsApiKey } : {}),
        ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
      },
    ];
  } else if (googleMapsApiKey) {
    plugins.push([
      "react-native-maps",
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
        ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
      },
    ]);
  }

  return {
    ...config,
    name: "Yopido Riders",
    android: {
      ...config.android,
      package: "shop.yopido.riders",
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins,
  };
};
