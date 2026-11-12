import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5181, strictPort: true },
  // Three.js alone is ~600 kB minified; one chunk is fine for a game that loads once.
  build: { chunkSizeWarningLimit: 1000 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
