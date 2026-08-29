import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative so the built folder can be served from anywhere on the booth machine.
  base: './',
  // Pinned so every display can run side by side without racing for a port.
  server: { port: 5175, allowedHosts: ['.trycloudflare.com'] },
  preview: { port: 4175, allowedHosts: ['.trycloudflare.com'] },
  // The poster is one screen of photography; inlining would bloat the entry HTML.
  build: { assetsInlineLimit: 4096 },
});
