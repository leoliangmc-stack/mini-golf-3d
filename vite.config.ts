import { defineConfig } from 'vitest/config';
import { replayRecorder } from './scripts/replay-recorder.mjs';

export default defineConfig({
  plugins: [replayRecorder()],
  // Expose the dev server on the LAN so phones and tablets can open it.
  server: { host: true },
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
