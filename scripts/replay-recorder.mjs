// Dev-server half of the dev panel's SAVE REPLAY button: writes the round the browser
// posts to replays/<holeId>.json. Never part of a build.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const MAX_BYTES = 256 * 1024;

/** @returns {import('vite').Plugin} */
export function replayRecorder() {
  return {
    name: 'replay-recorder',
    apply: 'serve',
    // A replay file changing must not reload the page: SAVE REPLAY writes one, and the
    // round just played would be thrown away. The next load of the page sees the new file.
    handleHotUpdate({ file, server }) {
      if (file.startsWith(`${path.join(server.config.root, 'replays')}${path.sep}`)) return [];
    },
    configureServer(server) {
      server.middlewares.use('/__replay', (req, res) => {
        const reply = (status, text) => {
          res.statusCode = status;
          res.end(text);
        };
        // The dev server is open to the local network so phones can play; writing files is not.
        if (req.method !== 'POST' || !LOCAL.has(req.socket.remoteAddress ?? '')) return reply(403, 'Local POST only');
        // Nor is it open to other pages in the same browser: a POST from any other site
        // would reach here from the local address too. Browsers set Origin on every POST.
        const origin = req.headers.origin;
        if (typeof origin !== 'string' || !origin.endsWith(`//${req.headers.host}`)) return reply(403, 'Same-origin POST only');
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > MAX_BYTES) req.destroy();
        });
        req.on('end', () => {
          try {
            const file = JSON.parse(body);
            const valid =
              typeof file.hole === 'string' &&
              /^[a-z0-9-]+$/.test(file.hole) &&
              Array.isArray(file.inputs) &&
              typeof file.expect === 'object' &&
              file.expect !== null;
            if (!valid) return reply(400, 'Not a replay file');
            const dir = path.join(server.config.root, 'replays');
            mkdirSync(dir, { recursive: true });
            writeFileSync(path.join(dir, `${file.hole}.json`), `${JSON.stringify(file, null, 2)}\n`);
            reply(200, `replays/${file.hole}.json`);
          } catch (error) {
            reply(400, String(error));
          }
        });
      });
    },
  };
}
