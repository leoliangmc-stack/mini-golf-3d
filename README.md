# 3D Mini Golf

> It's Mini Golf, but every world has a different rule.

A browser mini golf game: 2 chapters, 10 worlds, 32 holes, each world built around one
mechanic. TypeScript, Three.js and Rapier; a static site with no backend. Requirements
live in [SPEC.md](SPEC.md) (v1, Chapter 1), [SPEC-v2.md](SPEC-v2.md) (Chapter 2) and
SPEC v3.0 (Chapter 3, under way), which are the source of truth for scope and milestones.

**Play it: https://mini-golf-3d-self.vercel.app**

## Run

```bash
npm install
npm run dev      # dev server, also reachable from phones on the same Wi-Fi
npm test         # headless engine tests
npm run replay   # play back the reference solution of every hole, and report
npm run build    # typecheck + replay check + production build into dist/
```

Landscape only. Drag anywhere to aim (pull back, release to shoot). A pull that starts
close to a screen edge, such as straight down from the ball, reaches full power just
short of that edge, so the finger never has to leave the screen. Two fingers twist
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
| P0 replay check: file format, `npm run replay`, 32 reference solutions, CI | done |
| P1 goals (`cup` -> `goal`), several balls, ball state, skills | done |
| P2 to P7 Chapter 3: four worlds, the finale, save migration | engine in place and tested; the holes come in the next release |

Not yet verified on real devices: frame rate, touch feel, first-load time on 4G, and
audio on iOS. Everything so far was checked in a desktop browser and in headless tests.
For Chapter 2 that leaves, from SPEC v2 5.2: #5 (occlusion fading on phones) and #6
(the countdown pausing when a phone sends the page to the background). From SPEC v3
5.3, of #3, every browser but Chromium: open the dev build on the device and press
CHECK ALL REPLAYS in the dev panel.

### Open decisions

- **Analytics provider. This one blocks the v2 goal.** `src/app/analytics.ts` forwards
  events to Plausible or Umami if their script is on the page, and there is still no
  script on the page. Until one is added to `index.html` nothing is counted: not the
  players of v1 that the 40% return target is measured against (SPEC v2 5.1), and not
  the `save_migrated` event that counts who came back. That event is not lost in the
  meantime: a migrated save stays marked until a provider has taken the event once.
  The same goes for the v3 goal (SPEC v3 5.1).
- **What the v3 return target is measured against.** Chapter 3 opens after the Chapter 2
  finale, so only a player who has finished 32 holes can enter it. "40% of v2 players
  enter Chapter 3" therefore asks for 40% of them to finish the game. Either count
  against the players who finished Chapter 2, or let Chapter 3 open earlier; that is one
  condition in `Progress.isUnlocked`.
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

**What keeps a broken hole from going live is the build, not GitHub Actions.** Vercel
deploys on push whatever a workflow says, so `npm run build` runs the replay check
itself: if one hole's reference solution no longer plays back, the build fails and
nothing is deployed. `.github/workflows/replay.yml` runs the same checks on every push
and pull request, where the result can be seen before merging.

### Where this differs from SPEC v3.0

- **A goal's cup has `motion` and `hidden: LidDef`,** as the code has had since v2, not
  the `mover` and `HiddenDef` of the SPEC v3 2.8 sketch.
- **Determinism is not left to the Rapier build alone.** The deterministic build is in
  use (it gave bit-identical results to the old one on every recorded round), but
  JavaScript's own `Math.sin`, `Math.cos`, `Math.atan2`, `Math.hypot` and `**` are not
  the same in every engine. The simulation uses `core/math.ts` instead, built from
  arithmetic and `Math.sqrt` only, and a test keeps the others out.
- **The first ball in the cup wins, but the round waits for the others.** Balls still
  under way when one drops in play on until they stop, so that a second one dropping in
  can be asked for as a third-star challenge (SPEC v3 2.4).
- **A stroke is over when crates and pins have stopped too,** not only the balls, or
  after four seconds of waiting. Otherwise a pin still falling would be left standing.
- **Balls pass through one another.** Split halves start from the same spot, and a ball
  that could be knocked about by its twin would be far less predictable.
- **Picking a ball is not an input.** The player may change their mind freely; the
  stroke says which ball it was played with, and that is when the others vanish.
- **A stroke in mid-air does not move the place a lost ball returns to.** That stays
  where the last stroke from the ground was played, or the ball would be put back into
  thin air. A returning ball is also the size it was struck at.
- **Crates and low bars are new pieces of the schema** (`crates`, and a `beam` piece),
  which SPEC v3 2.8 does not list but 2.2 needs. A crate slides and never turns; a low
  bar is what "a narrow passage" is built from, because a gap between two walls asks
  for an aim no thumb can manage.
- **The reference solutions of the first 18 holes were found by a search script,** not
  recorded by hand. It is not part of the game or of this repository (SPEC v3 4). The
  routes it found are valid, not necessarily the intended ones: several par 3 holes
  turn out to have a hole in one.
- **Gravity zones still turn the whole world's gravity,** as in v1, when any ball is
  inside one. Nothing in Chapter 3 has both several balls and a gravity zone.

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
  core/math.ts  the only trigonometry the simulation may use (see Engine notes)
  physics/   Rapier wrapper and the mechanic layers: ball (and its sizes), surfaces,
             zones, movers, loose props (crates, pins)
  level/     chapter, world and hole data schema, compiler (data -> geometry), physics builder
  game/      session state machine, rules, goals (cup, pins, steps), the set of balls,
             skills, challenges, replay
  input/     slingshot aiming and camera gestures on Pointer Events
  render/    Three.js scene, camera, course, ball, zone and mover views, scenery,
             occlusion fading, quality tiers
  audio/     synthesised sound effects and generated music
  ui/        HTML/CSS HUD and menus, all interface text (en / zh)
  debug/     development panel (not included in production builds)
  data/      surfaces, themes, the ten worlds, the two finales and the chapter list
             (content only, no logic)
tests/       determinism, tunneling, seams, terrain, rules, scoring, movers, fields, saves,
             save migration, tunnels, the moving cup, countdown, rooftops, ball sizes,
             time freeze, clones, bowling and goals in steps, reference solutions
replays/     one reference solution per hole: its inputs and how the round ended
scripts/     the replay command and the dev server's SAVE REPLAY endpoint
```

## Adding content

A **hole** is one object in a world file under `src/data/worlds/`: tee, goal (a cup,
pins, or steps of them), par, pieces (floors, ramps, walls, pillars, low bars), zones,
movers, crates, skills, an optional third-star challenge. Nothing outside that file
changes, except that it needs a reference solution in `replays/` (see below).
`tests/worlds.test.ts` then checks it automatically.

A **world** is a new file there plus one line in `src/data/chapters.ts`, and, if it
wants its own look, entries in `src/data/themes.ts` and `src/data/surfaces.ts`.

A **chapter** is one more entry in `src/data/chapters.ts`: its worlds and its finale.
Menus, unlock order and saves all follow from that list.

A **new mechanic** is a module, registered by name so data can refer to it:

| Kind | Where | Example |
|---|---|---|
| Surface (what the ground does) | `src/data/surfaces.ts` | ice, sand |
| Zone (a region acting on the ball) | `src/physics/zones/` | magnet, gravity, launcher, pads |
| Skill (something the player does on purpose) | `src/game/skills.ts` | freeze |
| Zone visual | `src/render/zoneViews.ts` | magnet rings, cannon |
| Mover motion | `src/physics/movers.ts` | slide, swing, spin |
| Challenge check | `src/game/challenges.ts` | noWallHits, firstStrokeInto |
| Scenery model | `src/render/decor.ts` | canopy, tower, gear |

A zone talks to the game through `ZoneContext` only: it can move the ball, hold it
(`busy`), say that it jumped (`snap`), add time to the countdown (`addTime`) and name
a moment for sound and effects (`emit` a cue), make the ball a size bigger or smaller
(`resize`) and split it in two (`split`). With several balls on the course a zone is
run once per ball, so one that remembers something about a ball keeps it per ball
(`perBall`). Challenges can count cues.

`physics/`, `level/` and `game/` never mention a specific world.

## Development tools

The dev server adds a **DEV** button (bottom centre) that opens a panel to jump to any
hole, unlock everything, draw the physics colliders and zone volumes, replay the
strokes of the current round, check that a replay is identical 10 times over, and tune
feel values with sliders. **COPY CHANGES** exports whatever was changed as JSON.

URL switches, development only: `?hole=ice-2` starts on that hole (`ch1-finale` and
`ch2-finale` are the finales), `?unlock` opens every hole in every chapter. `?lang=zh`
or `?lang=en` forces a language in any build.

### Reference solutions

Every hole has one in `replays/<holeId>.json`: the inputs of a round that finishes it
(each stroke's tick, direction, power and ball, each use of a skill) and how that round
ended. `npm run replay` plays all 32 back without rendering, in well under a second,
and prints a report; `npm test` and `npm run build` run the same check. A round has to
end on the same tick, with the same strokes and stars, within a millimetre of the same
place. In practice it ends in exactly the same place, to the last bit, and the tests
ask for that. Each solution is also within par and earns the third star, which is the
proof that every hole and every challenge can be done.

A round depends on the exact physics numbers, so retuning a surface, the shot speed or
a hole breaks some of them. That is the check working, not a bug. After changing a hole
or a number on purpose:

- if the same inputs still finish the hole, `npm run replay -- --update <holeId>`
  records how the round ends now;
- otherwise play the hole in the dev build and press **SAVE REPLAY** in the dev panel,
  which writes the file through the dev server;
- commit the replay with the change, and say in the commit message which holes were
  recorded again and why.

**CHECK ALL REPLAYS** in the dev panel runs the same check in the browser. Its numbers
must match Node's exactly; that is how a difference between engines would show.

## Engine notes

- **The simulation uses no `Math.sin`, `Math.cos`, `Math.atan2`, `Math.hypot` or `**`.**
  The JavaScript standard lets engines differ in their last bit, and one bit in a
  wall's angle is enough to end a replay somewhere else. `core/math.ts` has
  replacements made of arithmetic and `Math.sqrt`; `tests/determinism.test.ts` fails
  if anything under `core/`, `physics/`, `game/` or `level/` uses the others. Drawing
  and sound may use them freely.
- **Props do not use continuous collision detection; the ball does.** Between two
  bodies that both do, Rapier lets a fast ball sink into a crate or come out the far
  side of a thin one.
- **A crate in a doorway needs door jambs.** With a plain gap in a wall, a fast ball
  wedges itself between the crate and the wall end and squeezes through.
- **Loose props multiply their friction with the other side's.** The ground's is 1 and
  the ball's is 0, so pins and crates grip the ground while the ball still slides off
  them, and the ball itself never feels the ground's value.
- **A pad is touched only by a ball on the ground**, and again only after the ball has
  left it. A ball flying over one is not changed.
- **Frozen time is no tick at all.** `Session.step` returns at once, so a freeze of any
  length replays as nothing but the inputs made during it.

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
