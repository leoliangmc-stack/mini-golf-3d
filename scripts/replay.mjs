// Replays the reference solution of every hole, without rendering (SPEC v3 2.9).
//
//   npm run replay                       check every hole; exits 1 if any fails
//   npm run replay -- ice-1 sky-2        check only these holes
//   npm run replay -- --update ice-1     re-record how these holes' rounds end
//   npm run replay -- --import file.json record rounds from { "<holeId>": [inputs] }
//
// The game is TypeScript written for a bundler, so it is loaded through Vite.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, createServerModuleRunner } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const replayDir = path.join(root, 'replays');

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return false;
  args.splice(at, 1);
  return true;
};
const update = flag('--update');
const importAt = args.indexOf('--import');
const importFile = importAt >= 0 ? args.splice(importAt, 2)[1] : null;

const usage = () => {
  console.error('usage: npm run replay [-- <holeId>...]');
  console.error('       npm run replay -- --update <holeId>...');
  console.error('       npm run replay -- --import <file.json>');
  process.exit(1);
};
// A mistyped command must not pass as "nothing to do".
if ((importAt >= 0 && !importFile) || (update && args.length === 0) || (update && importAt >= 0)) usage();

const server = await createServer({
  root,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});
const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });

const write = (file) => {
  mkdirSync(replayDir, { recursive: true });
  writeFileSync(path.join(replayDir, `${file.hole}.json`), `${JSON.stringify(file, null, 2)}\n`);
};

const describe = (result) =>
  result
    ? `${result.holed ? 'done' : 'stroke limit'} in ${result.strokes}, ${'★'.repeat(result.stars)}, tick ${result.tick}`
    : 'the hole did not end';

try {
  const { setupEngine } = await runner.import('/tests/helpers.ts');
  await setupEngine();
  const { REPLAYS, checkAllReplays, recordHoleReplay } = await runner.import('/src/debug/replays.ts');

  if (importFile || update) {
    const rounds = importFile
      ? JSON.parse(readFileSync(path.resolve(importFile), 'utf8'))
      : Object.fromEntries(args.map((id) => [id, REPLAYS[id]?.inputs]));
    let failed = 0;
    for (const [id, inputs] of Object.entries(rounds)) {
      const file = inputs && recordHoleReplay(id, inputs.map((input) => ({ type: 'shot', ...input })));
      if (!file?.expect.holed) {
        failed++;
        console.error(`✗ ${id}: ${inputs ? describe(file?.expect) : 'no recorded inputs'}; nothing written`);
        continue;
      }
      write(file);
      console.log(`● ${id}: ${describe(file.expect)}`);
    }
    process.exitCode = failed ? 1 : 0;
  } else {
    const started = performance.now();
    const report = checkAllReplays(args);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    for (const check of report.checks) {
      const state = check.ok ? (check.exact ? 'exact' : 'within tolerance') : 'FAILED';
      console.log(`${check.ok ? '✓' : '✗'} ${check.hole.padEnd(12)} ${describe(check.actual).padEnd(40)} ${state}`);
      for (const problem of check.problems) console.log(`    - ${problem}`);
    }
    for (const id of report.missing) console.log(`✗ ${id.padEnd(12)} no replay file`);
    for (const id of report.orphans) console.log(`✗ ${id.padEnd(12)} replay file for a hole that does not exist`);
    // A hole id that was asked for but matched nothing is a typo, not a pass.
    const seen = new Set([...report.checks.map((check) => check.hole), ...report.missing]);
    const unknown = args.filter((id) => !seen.has(id));
    for (const id of unknown) console.log(`✗ ${id.padEnd(12)} no such hole`);
    const passed = report.checks.filter((check) => check.ok).length;
    const exact = report.checks.filter((check) => check.exact).length;
    const total = report.checks.length + report.missing.length + unknown.length;
    console.log(`\n${passed}/${total} holes passed (${exact} exact) in ${seconds} s`);
    process.exitCode = report.ok && unknown.length === 0 ? 0 : 1;
  }
} finally {
  await runner.close();
  await server.close();
}
