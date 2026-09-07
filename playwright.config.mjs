import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://localhost:8093",
    channel: existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe") ? "msedge" : undefined,
    geolocation: { latitude: -17.3895, longitude: -66.1568 },
    permissions: ["geolocation"],
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-small", use: { viewport: { width: 360, height: 800 } } },
    { name: "mobile-large", use: { viewport: { width: 412, height: 915 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "node node_modules/expo/bin/cli start --offline --port 8093",
    url: "http://localhost:8093",
    reuseExistingServer: false,
    timeout: 120000,
    env: { CI: "1", EXPO_PUBLIC_API_BASE_URL: "http://localhost:8093", EXPO_PUBLIC_SUPABASE_URL: "", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", EXPO_PUBLIC_SUPABASE_ANON_KEY: "" },
  },
});
