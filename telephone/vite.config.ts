import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Literal IPv4, not `localhost`. Node resolves `localhost` to ::1 first on Windows, and
// if the worker is listening on IPv4 the proxy fails with an ECONNREFUSED that points
// nowhere useful.
const API = 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative so the built folder can be served from anywhere — the worker serves it from
  // the site root, and `vite preview` serves it from disk.
  base: './',
  // Pinned so this can run alongside the other three interactives.
  server: {
    port: 5176,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: API,
        changeOrigin: true,
        // The event stream must never be buffered or timed out by the dev proxy.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
  preview: { port: 4176, allowedHosts: ['.trycloudflare.com'] },
});
