import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Expose the dev server on the LAN so phones and tablets can open it.
  server: { host: true },
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
