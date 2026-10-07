# 3D Mini Golf

> It's Mini Golf, but every world has a different rule.

A browser mini golf game: 2 chapters, 10 worlds, 32 holes, each world built around one
mechanic. TypeScript, Three.js and Rapier; a static site with no backend. Requirements
live in [SPEC.md](SPEC.md) (v1, Chapter 1) and [SPEC-v2.md](SPEC-v2.md) (Chapter 2),
which are the source of truth for scope and milestones.

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
| N0 chapters, finale holes, save migration, chapter tabs | done |
| N1 Forest: tree tunnels | done |
| N2 Rooftop City: multi-level roofs, occlusion fading | done |
| N3 Moving Hole: travelling cup, track line, lid | done |
| N4 Bomb Ball: hole countdown, clocks, restart, way out after three blasts | done |
| N5 finales: Chapter 1 hole 19, Chapter 2 hole 13 | done |
| N6 polish: sound, music, text, events, deployment | done |
| N7 share the link again, watch who comes back | not started |

Not yet verified on real devices: frame rate, touch feel, first-load time on 4G, and
audio on iOS. Everything so far was checked in a desktop browser and in headless tests.
For Chapter 2 that leaves, from SPEC v2 5.2: #5 (occlusion fading on phones) and #6
(the countdown pausing when a phone sends the page to the background).

### Open decisions

- **Analytics provider. This one blocks the v2 goal.** `src/app/analytics.ts` forwards
  events to Plausible or Umami if their script is on the page, and there is still no
  script on the page. Until one is added to `index.html` nothing is counted: not the
  players of v1 that the 40% return target is measured against (SPEC v2 5.1), and not
  the `save_migrated` event that counts who came back. That event is not lost in the
  meantime: a migrated save stays marked until a provider has taken the event once.
- **Tuning by feel.** Shot power, camera, surface values and every par were set by
  calculation and by a search script, not by playing on a phone. The dev panel exists
  to tune them.
- **Countdown lengths.** The seconds on each Bomb Ball hole and on the Chapter 2 finale
  come from simulated rounds that allow about two seconds of aiming per stroke. SPEC v2
  2.6 asks for them to be set by playing on a phone; the dev panel has a slider for it.

### Deployment

The site is a plain static build (`npm run build`, output `dist/`) hosted on Vercel as
the project `mini-golf-3d`. The project is connected to this repository: every push to
`main` builds and goes live by itself, and other branches get preview URLs.

### Where this differs from SPEC v2.0

- **A moving cup has `motion`, not `mover`.** SPEC v2 2.10 sketches `cup.mover:
  MoverDef`, but a `MoverDef` is a box with a size, a surface and a role. What the cup
  shares with moving parts is the schedule, so it takes a `MotionDef` (`slide`, `swing`,
  `spin`) and runs on the same function of the tick they do.
- **Tunnel pairs and clocks are ordinary zones.** They are registered by name and keep
  their settings in `params`, like every v1 zone, instead of being new members of a
  `ZoneDef` union. Hole files build them with `tunnelPair(a, b)` and a small helper.
- **The finale is `FinaleDef`, not a bare `HoleDef`.** It needs a name, a look and a
  rule card of its own, so in the data it has the shape of a one-hole world.
- **A ball at rest can be holed.** A cup that travels, or whose lid opens, takes a ball
  lying in its way, as long as the two close slowly enough. Nothing else would look
  right, and it is what "follow the track" invites. The slick plate on Moving Hole 2
  is there so that parking on the line is not the whole game.
- **The save version field is `version`,** as v1 wrote it, not `saveVersion`. Version 2
  saves live under a new storage key; the v1 save is read once and never touched.
- **PLAY goes to the first unfinished hole** unless the hole last played is itself
  unfinished. Under the v1 rule a returning player who had finished all 18 holes
  would have been sent back to the last hole they had played, not to anything new.
- **Nothing runs behind the "rotate your device" notice,** so that a countdown cannot
  burn down while the course is covered.
- **Scenery is built in code,** as in v1: no Kenney kits (SPEC v2 2.12).

### Where this differs from SPEC v1.0

- **Audio is synthesised, not CC0 recordings.** Sound effects and a generated music
  loop per world come from Web Audio code (`src/audio/`), so the game ships no audio
  files. Swap in recorded tracks by replacing `src/audio/music.ts`.
- **No Kenney models.** Courses, obstacles, cannon, magnets and scenery are all built
  from primitives in code. Chapter 1 has no scenery; `decor` arrived with Chapter 2.
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
  app/       app wiring, game controller, saves, save migration and unlocks, analytics hook
  core/      fixed-step loop, shared types
  physics/   Rapier wrapper and the mechanic layers: ball, surfaces, zones, movers
  level/     chapter, world and hole data schema, compiler (data -> geometry), physics builder
  game/      session state machine, rules, the cup, challenges, replay
  input/     slingshot aiming and camera gestures on Pointer Events
  render/    Three.js scene, camera, course, ball, zone and mover views, scenery,
             occlusion fading, quality tiers
  audio/     synthesised sound effects and generated music
  ui/        HTML/CSS HUD and menus, all interface text (en / zh)
  debug/     development panel (not included in production builds)
  data/      surfaces, themes, the ten worlds, the two finales and the chapter list
             (content only, no logic)
tests/       determinism, tunneling, seams, terrain, rules, scoring, movers, fields, saves,
             save migration, tunnels, the moving cup, countdown, rooftops, known solutions
```

## Adding content

A **hole** is one object in a world file under `src/data/worlds/`: tee, cup, par,
pieces (floors, ramps, walls, pillars), zones, movers, an optional third-star challenge.
Nothing outside that file changes. `tests/worlds.test.ts` then checks it automatically.

A **world** is a new file there plus one line in `src/data/chapters.ts`, and, if it
wants its own look, entries in `src/data/themes.ts` and `src/data/surfaces.ts`.

A **chapter** is one more entry in `src/data/chapters.ts`: its worlds and its finale.
Menus, unlock order and saves all follow from that list.

A **new mechanic** is a module, registered by name so data can refer to it:

| Kind | Where | Example |
|---|---|---|
| Surface (what the ground does) | `src/data/surfaces.ts` | ice, sand |
| Zone (a region acting on the ball) | `src/physics/zones/` | magnet, gravity, launcher |
| Zone visual | `src/render/zoneViews.ts` | magnet rings, cannon |
| Mover motion | `src/physics/movers.ts` | slide, swing, spin |
| Challenge check | `src/game/challenges.ts` | noWallHits, firstStrokeInto |
| Scenery model | `src/render/decor.ts` | canopy, tower, gear |

A zone talks to the game through `ZoneContext` only: it can move the ball, hold it
(`busy`), say that it jumped (`snap`), add time to the countdown (`addTime`) and name
a moment for sound and effects (`emit` a cue). Challenges can count cues.

`physics/`, `level/` and `game/` never mention a specific world.

## Development tools

The dev server adds a **DEV** button (bottom centre) that opens a panel to jump to any
hole, unlock everything, draw the physics colliders and zone volumes, replay the
strokes of the current round, check that a replay is identical 10 times over, and tune
feel values with sliders. **COPY CHANGES** exports whatever was changed as JSON.

URL switches, development only: `?hole=ice-2` starts on that hole (`ch1-finale` and
`ch2-finale` are the finales), `?unlock` opens every hole in every chapter. `?lang=zh`
or `?lang=en` forces a language in any build.

`tests/solutions.test.ts` replays one recorded round per Chapter 2 hole and per finale:
proof that each can be finished within par with its third star. The rounds depend on
the exact physics numbers, so retuning a surface or the shot speed will break some of
them. That is the test working, not a bug: find a new round for those holes and
record it.

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
- **A tunnel decides one step ahead.** It takes a ball whose next step would bring it
  into the mouth while it is heading inward. Waiting for the ball to arrive would be
  too late: by then it has hit the trunk and is heading back out.
- **A mouth only takes a ball rolling against the way it faces.** That, more than the
  half-second pause after an exit, is what stops a ball being swallowed by the mouth it
  just left. The pause is shared by every tunnel of the hole.
- **The cup is judged by closing speed,** the ball's velocity minus the cup's, and it is
  where the tick says it is, not where the hole data says it starts. A cup that moves or
  has a lid is also checked while the ball lies still.
- **A shut lid is not a collider.** The cup was never a hole in the mesh, so "shut"
  only means the capture rule is off; the ground under it is the ordinary ground.
- **The countdown is counted in ticks** and only moves when the simulation steps, which
  is why pausing, the menus, a hidden tab and the rotate notice all stop it for free.
- **The course is drawn one mesh per ground piece but still rolls on one merged mesh.**
  The split is only so that a single building can be faded. Do not "simplify" the
  physics to match: separate colliders bring the seams back.
- **Occlusion fading never tests what stands less than 0.6 m above the ball.** That
  keeps rails solid and stops the floor flickering as a ball drops through it on its
  way out of bounds.
- **Scenery has no collider.** Do not put any on a surface a ball can reach, or beside
  a roof at roof height where it reads as part of the course.
