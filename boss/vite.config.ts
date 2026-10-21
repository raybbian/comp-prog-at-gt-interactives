import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative so the built folder can be served from anywhere.
  base: './',
  // Pinned so this can run alongside the other interactives on one laptop. Autopsy holds
  // 5177 and 4177; this one takes the next of each.
  server: { port: 5178, allowedHosts: ['.trycloudflare.com'] },
  preview: { port: 4178, allowedHosts: ['.trycloudflare.com'] },
});
