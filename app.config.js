module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || "";
  const plugins = [...(config.plugins ?? [])];

  if (!plugins.some((plugin) => Array.isArray(plugin) ? plugin[0] === "expo-location" : plugin === "expo-location")) {
    plugins.push([
      "expo-location",
      {
        locationWhenInUsePermission: "Permite que Yopido Riders use tu ubicacion durante la entrega.",
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

  if (googleMapsApiKey && !plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-maps")) {
    plugins.push([
      "react-native-maps",
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ]);
  }

  return {
    ...config,
    android: {
      ...config.android,
      package: "shop.yopido.riders",
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins,
  };
};
