import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host: true → also reachable from your phone on the same Wi-Fi
  server: { host: true },
  // three.js alone is ~600 kB; that's expected for a WebGL site
  build: { chunkSizeWarningLimit: 1200 }
});
