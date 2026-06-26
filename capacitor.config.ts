import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "in.educationvibes.nexus",
  appName: "Nexus HRMS",
  // Bundled fallback assets (shown while connecting / when offline).
  webDir: "mobile-shell",
  backgroundColor: "#f1f5f9",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#2563eb",
      showSpinner: false,
    },
  },
  // The app loads your live Next.js site in the native shell. Set this to your
  // deployed HTTPS URL for production, or your PC's LAN IP for on-device dev:
  //   production:  https://app.educationvibes.in
  //   LAN dev:     http://192.168.1.54:3000   (also set cleartext: true)
  server: {
    url: "https://app.educationvibes.in",
    // cleartext: true, // enable only for http:// LAN dev URLs
  },
};

export default config;
