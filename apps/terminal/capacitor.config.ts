import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eticketing.terminal',
  appName: 'E-Ticketing Terminal',
  webDir: 'dist/terminal-mobile',
  server: {
    // API is HTTP-only; https scheme blocks mixed-content XHR in the WebView
    androidScheme: 'http',
  },
  android: {
    path: 'projects/terminal-mobile/android',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
