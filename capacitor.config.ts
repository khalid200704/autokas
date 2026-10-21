import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autokas.app',
  appName: 'AutoKas',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  android: {
    captureInput: true,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#f5f7f2',
      style: 'DARK',
    },
  },
};

export default config;
