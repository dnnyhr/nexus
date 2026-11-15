import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Relative base so the build works at any path (Netlify, a subdomain or GitHub Pages).
// Two pages: the game (index.html) and the model viewer (viewer.html).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        viewer: resolve(import.meta.dirname, 'viewer.html'),
      },
    },
  },
});
