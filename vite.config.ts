import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5181, strictPort: true },
  // Three.js alone is ~600 kB minified; one chunk is fine for a game that loads once.
  // Two pages: the landing page at / (plain HTML and CSS, no Three.js) and the game at /play/.
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: { input: { main: 'index.html', play: 'play/index.html' } },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
