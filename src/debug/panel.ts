import './debug.css';
import type { Game } from '../app/game';
import type { Progress } from '../app/progress';
import { verifyDeterminism } from '../game/replay';
import { el } from '../ui/dom';
import { createOverlays } from './overlays';
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
    const shots = [...game.session.shots];
    if (shots.length === 0) return;
    game.replay(shots);
    shotStatus.textContent = `Replaying ${shots.length} stroke(s)…`;
  });

  checkButton.addEventListener('click', () => {
    const shots = [...game.session.shots];
    if (shots.length === 0) return;
    const { identical, outcome } = verifyDeterminism(game.hole, shots, 10);
    const where = outcome.position.map((v) => v.toFixed(3)).join(', ');
    shotStatus.textContent = identical
      ? `10/10 identical: ${outcome.holed ? 'holed' : outcome.phase} after ${outcome.strokes}, tick ${outcome.tick}, at (${where})`
      : 'MISMATCH between runs: the simulation is not deterministic';
    shotStatus.classList.toggle('bad', !identical);
  });

  // The round so far, exact to the last digit: what tests/solutions.test.ts records.
  const copyShotsButton = el('button', { type: 'button', textContent: 'COPY STROKES' });
  copyShotsButton.addEventListener('click', () => {
    const shots = JSON.stringify(game.session.shots);
    navigator.clipboard?.writeText(shots).catch(() => {});
    shotStatus.textContent = shots;
    shotStatus.classList.remove('bad');
  });

  const refreshShots = () => {
    shotList.replaceChildren(
      ...game.session.shots.map((shot) =>
        el('li', {
          textContent: `tick ${shot.tick} · dir ${shot.dir[0].toFixed(2)}, ${shot.dir[2].toFixed(2)} · power ${shot.power.toFixed(3)}`,
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
      shotStatus,
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
    if (event.type === 'hole' || event.type === 'shot' || event.type === 'reset') refreshShots();
  });
  holeSelect.value = `${game.worlds.indexOf(game.world)}:${game.holeIndex}`;
  rebuildTuning();
  refreshShots();
}
