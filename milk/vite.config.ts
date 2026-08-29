import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative so the built folder can be served from anywhere on the booth machine.
  base: './',
  // Pinned so two interactives can run side by side without racing for a port.
  server: { port: 5174, allowedHosts: ['.trycloudflare.com'] },
  preview: { port: 4174, allowedHosts: ['.trycloudflare.com'] },
});
