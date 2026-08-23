import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built bundle also works from the file:// style
  // WebView roots used by Capacitor on iOS and Android.
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  }
});
