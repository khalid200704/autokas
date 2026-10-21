import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autokas.app',
  appName: 'AutoKas',
  webDir: 'public',
  server: {
    url: 'https://autokas-ohuv.vercel.app',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'autokas-ohuv.vercel.app',
      '*.vercel.app',
      '*.supabase.co',
      '*.google.com',
      '*.googleapis.com',
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
};

export default config;
