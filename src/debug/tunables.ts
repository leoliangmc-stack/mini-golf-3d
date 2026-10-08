import type { Game } from '../app/game';
import { goalCups } from '../game/goal';
import { RULES } from '../game/rules';
import { INPUT } from '../input/slingshot';
import { getSurface } from '../physics/surfaces';
import { CAMERA_DEFAULTS, type CameraParams } from '../render/camera';

export interface Tunable {
  /** Stable name used when exporting changed values. */
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get(): number;
  set(value: number): void;
  /** True if the hole must be rebuilt for the change to take full effect. */
  rebuild?: boolean;
}

export interface TunableGroup {
  title: string;
  items: Tunable[];
}

type Range = [min: number, max: number, step: number];

/** A slider bound directly to a numeric field of an object. */
function field(key: string, label: string, target: object, name: string, range: Range, rebuild = false): Tunable {
  const bag = target as Record<string, number>;
  return {
    key,
    label,
    min: range[0],
    max: range[1],
    step: range[2],
    rebuild,
    get: () => bag[name],
    set: (value) => {
      bag[name] = value;
    },
  };
}

/** Every value worth tuning by feel for the hole currently loaded. */
export function collectTunables(game: Game): TunableGroup[] {
  const hole = game.hole;

  const camera = (name: keyof CameraParams, label: string, range: Range): Tunable => {
    // Tune the hole's own override if it has one, otherwise the shared default.
    const overridden = hole.camera?.[name] !== undefined;
    const store = (overridden ? hole.camera : CAMERA_DEFAULTS) as Record<string, number>;
    return {
      key: overridden ? `camera.${hole.id}.${name}` : `camera.default.${name}`,
      label,
      min: range[0],
      max: range[1],
      step: range[2],
      get: () => game.camera.params[name],
      set: (value) => {
        store[name] = value;
        game.camera.params[name] = value;
      },
    };
  };

  const gravity = field('rules.gravity', 'gravity', RULES, 'gravity', [2, 30, 0.1]);

  const surfaceIds = [...new Set(hole.pieces.map((piece) => piece.surface))];

  return [
    {
      title: 'Shot',
      items: [
        field('rules.maxShotSpeed', 'max speed (m/s)', RULES, 'maxShotSpeed', [6, 30, 0.5]),
        field('input.fullDragMinPx', 'full drag, min px', INPUT, 'fullDragMinPx', [60, 300, 5]),
        field('input.fullDragFraction', 'full drag, of screen', INPUT, 'fullDragFraction', [0.1, 0.6, 0.01]),
        field('input.edgeMarginPx', 'full drag, px short of edge', INPUT, 'edgeMarginPx', [0, 60, 1]),
        field('input.minRoomFraction', 'full drag, least of usual', INPUT, 'minRoomFraction', [0.1, 1, 0.05]),
      ],
    },
    {
      title: 'Camera',
      items: [
        camera('pitch', 'pitch (deg)', [25, 85, 1]),
        camera('minDistance', 'closest', [4, 20, 0.5]),
        camera('maxDistance', 'furthest', [12, 50, 1]),
      ],
    },
    { title: 'Physics', items: [gravity] },
    // The countdown of a timed hole is meant to be set by playing it on a phone (SPEC v2 2.6).
    ...(hole.timer
      ? [
          {
            title: `Countdown (${hole.id})`,
            items: [field(`timer.${hole.id}.seconds`, 'seconds', hole.timer, 'seconds', [5, 60, 1], true)],
          },
        ]
      : []),
    ...goalCups(hole.goal).map((cup, i) => {
      // The first cup keeps the name it had when holes had only the one.
      const key = i === 0 ? `cup.${hole.id}` : `cup.${hole.id}.${i}`;
      return {
        title: `Cup (${hole.id}${i === 0 ? '' : ` #${i + 1}`})`,
        items: [
          field(`${key}.radius`, 'radius', cup, 'radius', [0.12, 0.5, 0.01], true),
          field(`${key}.captureSpeed`, 'capture speed', cup, 'captureSpeed', [1, 8, 0.1], true),
        ],
      };
    }),
    ...surfaceIds.map((id) => {
      const surface = getSurface(id);
      return {
        title: `Surface: ${id}`,
        items: [
          field(`surface.${id}.rollingResistance`, 'rolling resistance', surface, 'rollingResistance', [0, 3, 0.01]),
          field(`surface.${id}.drag`, 'drag', surface, 'drag', [0, 2, 0.01]),
          field(`surface.${id}.restitution`, 'bounce', surface, 'restitution', [0, 1, 0.01], true),
        ],
      };
    }),
  ];
}
