import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eticketing.terminal',
  appName: 'E-Ticketing Terminal',
  webDir: 'dist/terminal-mobile',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
