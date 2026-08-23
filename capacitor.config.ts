import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.skydodge',
  appName: 'Sky Dodge',
  webDir: 'dist',
  android: {
    // The game renders its own background; let the WebView match it so there
    // is no white flash between the splash screen and the first frame.
    backgroundColor: '#0b1026'
  },
  ios: {
    backgroundColor: '#0b1026',
    contentInset: 'never'
  }
};

export default config;
