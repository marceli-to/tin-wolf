import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5181, strictPort: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
