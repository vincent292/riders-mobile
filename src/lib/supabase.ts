import "react-native-url-polyfill/auto";

import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";

import { config, isSupabaseConfigured } from "./config";

const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(key) ?? null;
    }

    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  if (client) return client;

  client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
      persistSession: true,
      storage: secureStorage,
    },
  });

  return client;
}

AppState.addEventListener("change", (state) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  if (state === "active") {
    void supabase.auth.startAutoRefresh();
    return;
  }

  void supabase.auth.stopAutoRefresh();
});
