# 3D Mini Golf

> It's Mini Golf, but every world has a different rule.

A browser mini golf game: 6 worlds, 18 holes, each world built around one mechanic.
TypeScript, Three.js and Rapier; a static site with no backend. Requirements live in
[SPEC.md](SPEC.md), which is the source of truth for scope and milestones.

**Play it: https://mini-golf-3d-self.vercel.app**

## Run

```bash
npm install
npm run dev      # dev server, also reachable from phones on the same Wi-Fi
npm test         # headless engine tests
npm run build    # typecheck + production build into dist/
```

Landscape only. Drag anywhere to aim (pull back, release to shoot). Two fingers twist
and pinch the camera; on a desktop, right-drag and the wheel do the same.

## Status

| Milestone | State |
|---|---|
| M0 technical prototype | done |
| M1 data pipeline + Snow & Ice | done |
| M2 Desert Ruins + Sky Island, stars, challenges, stroke limit | done |
| M3 Pirate Island: moving parts, cannon | done |
| M4 Magnetic Fields + Gravity Shift | done |
| M5 menus, saves, languages, audio, quality tiers, analytics hook, deployment | done |
| M6 friends playtest | not started |

Not yet verified on real devices: frame rate, touch feel, first-load time on 4G, and
audio on iOS. Everything so far was checked in a desktop browser and in headless tests.

### Open decisions

- **Analytics provider.** `src/app/analytics.ts` forwards events to Plausible or Umami
  if their script is on the page. Pick one and add its script tag to `index.html`.
- **Tuning by feel.** Shot power, camera, surface values and every par were set by
  calculation and by a search script, not by playing on a phone. The dev panel exists
  to tune them.

### Deployment

The site is a plain static build (`npm run build`, output `dist/`) hosted on Vercel as
the project `mini-golf-3d`. The project is connected to this repository: every push to
`main` builds and goes live by itself, and other branches get preview URLs.

### Where this differs from SPEC v1.0

- **Audio is synthesised, not CC0 recordings.** Sound effects and a generated music
  loop per world come from Web Audio code (`src/audio/`), so the game ships no audio
  files. Swap in recorded tracks by replacing `src/audio/music.ts`.
- **No Kenney models or decor.** Courses, obstacles, cannon and magnets are all built
  from primitives in code; the `decor` field from SPEC 2.12 does not exist yet.
- **Gravity zones lean gravity, they do not flip it.** Inside a zone "down" tilts
  sideways (or weakens), so the ball slides across the floor and along walls. There is
  no rolling on walls or ceilings.
- **Surfaces have no friction coefficient.** See the engine notes below.
- **Rapier's `-compat` package inlines its WASM**, which makes the engine chunk about
  1.8 MB gzipped. The start screen itself is 6 kB and shows immediately; the engine
  loads behind it.

## Layout

```
src/
  main.ts    tiny entry: start screen now, engine loaded in the background
  app/       app wiring, game controller, saves and unlocks, analytics hook
  core/      fixed-step loop, shared types
  physics/   Rapier wrapper and the mechanic layers: ball, surfaces, zones, movers
  level/     world and hole data schema, compiler (data -> geometry), physics builder
  game/      session state machine, rules, challenges, replay
  input/     slingshot aiming and camera gestures on Pointer Events
  render/    Three.js scene, camera, course, ball, zone and mover views, quality tiers
  audio/     synthesised sound effects and generated music
  ui/        HTML/CSS HUD and menus, all interface text (en / zh)
  debug/     development panel (not included in production builds)
  data/      surfaces, themes and the six worlds (content only, no logic)
tests/       determinism, tunneling, seams, terrain, rules, scoring, movers, fields, saves
```

## Adding content

A **hole** is one object in a world file under `src/data/worlds/`: tee, cup, par,
pieces (floors, ramps, walls, pillars), zones, movers, an optional third-star challenge.
Nothing outside that file changes. `tests/worlds.test.ts` then checks it automatically.

A **world** is a new file there plus one line in `src/data/worlds/index.ts`, and, if it
wants its own look, entries in `src/data/themes.ts` and `src/data/surfaces.ts`.

A **new mechanic** is a module, registered by name so data can refer to it:

| Kind | Where | Example |
|---|---|---|
| Surface (what the ground does) | `src/data/surfaces.ts` | ice, sand |
| Zone (a region acting on the ball) | `src/physics/zones/` | magnet, gravity, launcher |
| Zone visual | `src/render/zoneViews.ts` | magnet rings, cannon |
| Mover motion | `src/physics/movers.ts` | slide, swing, spin |
| Challenge check | `src/game/challenges.ts` | noWallHits, firstStrokeInto |

`physics/`, `level/` and `game/` never mention a specific world.

## Development tools

The dev server adds a **DEV** button (bottom centre) that opens a panel to jump to any
hole, unlock everything, draw the physics colliders and zone volumes, replay the
strokes of the current round, check that a replay is identical 10 times over, and tune
feel values with sliders. **COPY CHANGES** exports whatever was changed as JSON.

URL switches, development only: `?hole=ice-2` starts on that hole, `?unlock` opens
every hole. `?lang=zh` or `?lang=en` forces a language in any build.

## Engine notes

Decisions that are easy to undo by accident:

- **Time is counted in physics ticks** (60 per second), never wall-clock time. A stroke
  is reproducible from its tick, direction and power; moving parts are pure functions of
  the tick.
- **The ball does not rotate in the physics world and nothing has friction.** How the
  ball slows down is set per surface by `rollingResistance` and `drag`. Rapier caps
  angular velocity at 45 degrees per step, which makes a physically rolling ball of this
  size skid above ~4.7 m/s. The visible spin is computed by the renderer.
- **All ground pieces of a hole compile into one triangle mesh** with
  `FIX_INTERNAL_EDGES`. Separate adjacent colliders deflect a rolling ball at every seam.
  Ground bounds must sit on a 0.5 m grid so pieces share vertices. The solid under each
  piece stops 5 cm short of the surface for the same reason.
- **Author one wall piece per straight run**, again because of seams.
- **A platform's top sits a few millimetres above the ground it joins, overlaps it, and
  only collides with a ball that is above it.** That is what lets the ball roll on and
  off without tripping on the platform's edge.
- **Pushers need more than a ball's width of clearance** from any wall at the ends of
  their travel, or the ball is crushed between two immovable things.
- **The ball may not rest on a moving part or in its path** (a mover's `sweep`); it is
  moved to the nearest `rest` point listed for that mover.
- **The cup is a rule, not a hole in the mesh**: the ball is captured when it is inside
  the cup radius and slower than `captureSpeed`.
- **"Down" is `world.up` negated**, not -Y, and gravity zones change it. The course
  floor itself is always level: shots are launched along it regardless of gravity.
- **Walls a ball can fall onto must be soft** (see the `padded` surface): a bouncy wall
  under sideways gravity keeps the ball bouncing for a long time.
