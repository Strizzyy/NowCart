import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match your Android app ID — reverse domain style
  appId: 'com.nowcart.app',
  appName: 'NowCart',

  // Capacitor reads from the Vite build output
  webDir: 'dist',

  // Point to your live AWS backend so the APK hits real data
  // Change this to your actual deployed URL
  server: {
    // When set, Capacitor loads this URL instead of the bundled dist/
    // This means the APK is always up-to-date with your live deployment.
    // Comment out `url` to bundle the app offline-capable instead.
    url: 'https://d2hj5yrm8sue4v.cloudfront.net',
    cleartext: false,          // HTTPS only — no HTTP
    androidScheme: 'https',
  },

  android: {
    // Status bar blends with your dark theme
    backgroundColor: '#0f172a',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
