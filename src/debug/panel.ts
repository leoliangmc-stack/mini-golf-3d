import './debug.css';
import type { Game } from '../app/game';
import type { Progress } from '../app/progress';
import { recordReplay, verifyDeterminism, type ReplayInput } from '../game/replay';
import { el } from '../ui/dom';
import { createOverlays } from './overlays';
import { checkAllReplays, REPLAYS } from './replays';
import { collectTunables, type Tunable } from './tunables';

const round = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Development-only panel (SPEC 2.13): jump between holes, see what the physics sees,
 * replay strokes, and tune the feel live. Loaded only by the dev server.
 */
export function mountDebugPanel(game: Game, progress: Progress): void {
  const overlays = createOverlays(game);
  /** Value of each tunable when first seen, to report and undo changes. */
  const baseline = new Map<string, number>();
  let tunables: Tunable[] = [];

  // --- Hole -----------------------------------------------------------------
  const holeSelect = el('select');
  game.worlds.forEach((world, w) => {
    world.holes.forEach((hole, h) => holeSelect.append(el('option', { value: `${w}:${h}`, textContent: hole.id })));
  });
  holeSelect.addEventListener('change', () => {
    const [w, h] = holeSelect.value.split(':').map(Number);
    game.loadHole(game.worlds[w], h);
  });
  const unlock = el('input', { type: 'checkbox', checked: progress.unlockAll });
  unlock.addEventListener('change', () => {
    progress.unlockAll = unlock.checked;
  });

  // --- Overlays -------------------------------------------------------------
  const toggle = (label: string, onChange: (on: boolean) => void) => {
    const input = el('input', { type: 'checkbox' });
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { className: 'dev-check' }, input, label);
  };

  // --- Shots ----------------------------------------------------------------
  const shotList = el('ol', { className: 'dev-shots' });
  const shotStatus = el('div', { className: 'dev-status' });
  const replayButton = el('button', { type: 'button', textContent: 'REPLAY' });
  const checkButton = el('button', { type: 'button', textContent: 'CHECK ×10' });

  replayButton.addEventListener('click', () => {
    const inputs = [...game.session.inputs];
    if (inputs.length === 0) return;
    game.replay(inputs);
    shotStatus.textContent = `Replaying ${inputs.length} input(s)…`;
  });

  checkButton.addEventListener('click', () => {
    const inputs = [...game.session.inputs];
    if (inputs.length === 0) return;
    const { identical, outcome } = verifyDeterminism(game.hole, inputs, 10);
    const where = outcome.position.map((v) => v.toFixed(3)).join(', ');
    shotStatus.textContent = identical
      ? `10/10 identical: ${outcome.holed ? 'holed' : outcome.phase} after ${outcome.strokes}, tick ${outcome.tick}, at (${where})`
      : 'MISMATCH between runs: the simulation is not deterministic';
    shotStatus.classList.toggle('bad', !identical);
  });

  // The round so far, exact to the last digit: what tests/solutions.test.ts records.
  const copyShotsButton = el('button', { type: 'button', textContent: 'COPY STROKES' });
  copyShotsButton.addEventListener('click', () => {
    const shots = JSON.stringify(game.session.inputs);
    navigator.clipboard?.writeText(shots).catch(() => {});
    shotStatus.textContent = shots;
    shotStatus.classList.remove('bad');
  });

  // The finished round as the hole's reference solution (SPEC v3 2.9), written to
  // replays/<hole>.json by the dev server. `npm run replay` then plays it back in Node.
  const saveReplayButton = el('button', { type: 'button', textContent: 'SAVE REPLAY' });
  saveReplayButton.addEventListener('click', async () => {
    const { session } = game;
    const fail = (text: string) => {
      shotStatus.textContent = text;
      shotStatus.classList.add('bad');
    };
    if (!session.outcome?.holed) return fail('Finish the hole first: a reference solution has to complete it.');
    const inputs: ReplayInput[] = [...session.inputs];
    const file = recordReplay(game.hole, inputs);
    // Played back without the screen, the round has to end exactly as it just did.
    const same =
      file !== null && file.expect.strokes === session.outcome.strokes && file.expect.stars === session.outcome.stars;
    if (!file || !same) return fail('MISMATCH: played back, this round ends differently. Not saved.');
    const response = await fetch('/__replay', { method: 'POST', body: JSON.stringify(file) }).catch(() => null);
    if (!response?.ok) return fail(`Could not save: ${response ? await response.text() : 'no dev server'}`);
    // The page is not reloaded for the new file, so CHECK ALL REPLAYS is told about it here.
    REPLAYS[file.hole] = file;
    shotStatus.textContent = `Saved ${await response.text()}: ${file.expect.strokes} stroke(s), ${file.expect.stars} star(s)`;
    shotStatus.classList.remove('bad');
  });

  // Every reference solution, played back in this browser. The numbers must match what
  // `npm run replay` prints in Node, to the last bit (SPEC v3 5.3 #3).
  const checkAllButton = el('button', { type: 'button', textContent: 'CHECK ALL REPLAYS' });
  const replayStatus = el('div', { className: 'dev-status' });
  checkAllButton.addEventListener('click', () => {
    const report = checkAllReplays();
    const exact = report.checks.filter((check) => check.exact).length;
    const passed = report.checks.filter((check) => check.ok).length;
    const lines = [`${passed}/${report.checks.length + report.missing.length} holes passed (${exact} exact)`];
    for (const check of report.checks) if (!check.ok) lines.push(`${check.hole}: ${check.problems.join('; ')}`);
    for (const check of report.checks) if (check.ok && !check.exact) lines.push(`${check.hole}: within tolerance, not exact`);
    if (report.missing.length > 0) lines.push(`no replay: ${report.missing.join(', ')}`);
    if (report.orphans.length > 0) lines.push(`no such hole: ${report.orphans.join(', ')}`);
    replayStatus.textContent = lines.join('\n');
    replayStatus.classList.toggle('bad', !report.ok);
  });

  const refreshShots = () => {
    shotList.replaceChildren(
      ...game.session.inputs.map((input) =>
        el('li', {
          textContent:
            input.type === 'shot'
              ? `tick ${input.tick} · dir ${input.dir[0].toFixed(2)}, ${input.dir[2].toFixed(2)} · power ${input.power.toFixed(3)}${input.ball ? ` · ball ${input.ball}` : ''}`
              : `tick ${input.tick} · ${input.type === 'skill' ? input.id : 'resume'}`,
        }),
      ),
    );
  };

  // --- Tuning ---------------------------------------------------------------
  const tuning = el('div');
  const exportBox = el('textarea', { className: 'dev-export', readOnly: true, rows: 4 });

  const changedValues = (): Record<string, number> => {
    const changed: Record<string, number> = {};
    for (const t of tunables) {
      const value = round(t.get());
      if (value !== baseline.get(t.key)) changed[t.key] = value;
    }
    return changed;
  };

  const rebuildTuning = () => {
    const groups = collectTunables(game);
    tunables = groups.flatMap((group) => group.items);
    tuning.replaceChildren(
      ...groups.map((group) =>
        el(
          'fieldset',
          {},
          el('legend', { textContent: group.title }),
          ...group.items.map((t) => {
            if (!baseline.has(t.key)) baseline.set(t.key, round(t.get()));
            const output = el('output', { textContent: String(round(t.get())) });
            const slider = el('input', {
              type: 'range',
              min: String(t.min),
              max: String(t.max),
              step: String(t.step),
              value: String(t.get()),
            });
            slider.addEventListener('input', () => {
              t.set(Number(slider.value));
              output.textContent = String(round(t.get()));
            });
            // Rebuild on release, not while dragging: it recreates this very slider.
            slider.addEventListener('change', () => {
              if (t.rebuild) game.reloadHole();
            });
            return el('label', { className: 'dev-slider' }, el('span', { textContent: t.label }), output, slider);
          }),
        ),
      ),
    );
  };

  const copyButton = el('button', { type: 'button', textContent: 'COPY CHANGES' });
  copyButton.addEventListener('click', () => {
    exportBox.value = JSON.stringify(changedValues(), null, 1);
    exportBox.select();
    // Clipboard access needs HTTPS or localhost; over plain LAN the text stays selected to copy by hand.
    navigator.clipboard?.writeText(exportBox.value).catch(() => {});
  });

  const resetButton = el('button', { type: 'button', textContent: 'RESET ALL' });
  resetButton.addEventListener('click', () => {
    for (const t of tunables) t.set(baseline.get(t.key) ?? t.get());
    exportBox.value = '';
    game.reloadHole();
  });

  // --- Layout ---------------------------------------------------------------
  const panel = el(
    'aside',
    { id: 'dev-panel', hidden: true },
    el(
      'section',
      {},
      el('h2', { textContent: 'Hole' }),
      holeSelect,
      el('label', { className: 'dev-check' }, unlock, 'Unlock all holes'),
    ),
    el(
      'section',
      {},
      el('h2', { textContent: 'Overlays' }),
      toggle('Colliders', (on) => overlays.setColliders(on)),
      toggle('Zones', (on) => overlays.setZones(on)),
    ),
    el(
      'section',
      {},
      el('h2', { textContent: 'Strokes this round' }),
      shotList,
      el('div', { className: 'dev-row' }, replayButton, checkButton, copyShotsButton),
      el('div', { className: 'dev-row' }, saveReplayButton),
      shotStatus,
    ),
    el(
      'section',
      {},
      el('h2', { textContent: 'Reference solutions' }),
      el('div', { className: 'dev-row' }, checkAllButton),
      replayStatus,
    ),
    el(
      'section',
      {},
      el('h2', { textContent: 'Tuning' }),
      tuning,
      el('div', { className: 'dev-row' }, copyButton, resetButton),
      exportBox,
    ),
  );

  const opener = el('button', { id: 'dev-toggle', type: 'button', textContent: 'DEV' });
  opener.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    opener.classList.toggle('open', !panel.hidden);
  });
  document.body.append(panel, opener);

  game.on((event) => {
    if (event.type === 'hole') {
      holeSelect.value = `${game.worlds.indexOf(game.world)}:${game.holeIndex}`;
      shotStatus.textContent = '';
      rebuildTuning();
    }
    const input = event.type === 'shot' || event.type === 'frozen' || event.type === 'resumed';
    if (event.type === 'hole' || event.type === 'reset' || input) refreshShots();
  });
  holeSelect.value = `${game.worlds.indexOf(game.world)}:${game.holeIndex}`;
  rebuildTuning();
  refreshShots();
}
