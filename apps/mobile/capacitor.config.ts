import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sweptmind.app",
  appName: "SweptMind",
  webDir: "www",
  server: {
    url: "https://sweptmind.com",
    cleartext: false,
  },
  plugins: {
    // Android: MainActivity insets the WebView itself — the web app sets viewport-fit=cover
    // without safe-area padding, which Capacitor would draw under the system bars
    SystemBars: {
      insetsHandling: "disable",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
