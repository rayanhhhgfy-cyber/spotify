import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rayyan.musicplayer',
  appName: 'Music',
  webDir: 'dist',
  // Load the live deployed site directly instead of bundling a static snapshot. The native
  // shell then just needs to be built/installed once - every future `git push` to main that
  // triggers a Vercel deploy shows up automatically next time the app launches, no rebuild or
  // re-signing needed for content updates (only the one-time signing refresh SideStore/AltStore
  // already handles for free sideloading).
  server: {
    url: 'https://spotify-rayyan.vercel.app',
    cleartext: false,
    allowNavigation: ['spotify-rayyan.vercel.app', '*.vercel.app']
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    // WKWebView audio must not be muted by the hardware silent/ring switch for a music app.
    allowsLinkPreview: false
  }
};

export default config;
