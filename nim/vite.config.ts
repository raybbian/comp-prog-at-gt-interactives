import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative so the built folder can be served from anywhere on the booth machine.
  base: './',
  // Pinned so two interactives can run side by side without racing for a port.
  server: { port: 5173 },
  preview: { port: 4173 },
});
