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
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
