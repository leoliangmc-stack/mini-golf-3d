import type { HtmlTagDescriptor, Plugin } from 'vite';
import wasm from 'vite-plugin-wasm';
import { defineConfig } from 'vitest/config';
import { replayRecorder } from './scripts/replay-recorder.mjs';

/**
 * Tells the browser about the engine before the start screen's script asks for it: the
 * game chunk (three.js and all) and the physics WASM are the whole download, and both
 * are only discovered by a dynamic import in `main.ts`, one round trip late. Build only;
 * the dev server serves modules as they are asked for.
 */
function preloadEngine(): Plugin {
  return {
    name: 'preload-engine',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        if (!bundle) return [];
        const tags: HtmlTagDescriptor[] = [];
        for (const item of Object.values(bundle)) {
          if (item.type === 'chunk' && item.facadeModuleId?.endsWith('/src/app/app.ts')) {
            tags.push({ tag: 'link', attrs: { rel: 'modulepreload', href: `/${item.fileName}` }, injectTo: 'head' });
          } else if (item.type === 'asset' && item.fileName.endsWith('.wasm')) {
            tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'fetch', href: `/${item.fileName}`, crossorigin: true }, injectTo: 'head' });
          }
        }
        return tags;
      },
    },
  };
}

export default defineConfig({
  plugins: [wasm(), replayRecorder(), preloadEngine()],
  // Expose the dev server on the LAN so phones and tablets can open it.
  server: { host: true },
  build: { target: 'es2022' },
  // The engine imports its WASM as a module. The dependency pre-bundler cannot follow
  // that, and neither can Node: in the tests and the replay check the package goes
  // through Vite like the game's own code, so the plugin can inline the WASM for Node.
  optimizeDeps: { exclude: ['@dimforge/rapier3d-deterministic'] },
  ssr: { noExternal: ['@dimforge/rapier3d-deterministic'] },
  // The package names its entry only in the `module` field, which not every resolver reads.
  resolve: { alias: { '@dimforge/rapier3d-deterministic': '@dimforge/rapier3d-deterministic/rapier.js' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    server: { deps: { inline: ['@dimforge/rapier3d-deterministic'] } },
  },
});
