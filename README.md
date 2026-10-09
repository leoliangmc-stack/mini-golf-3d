# 3D Mini Golf

> It's Mini Golf, but every world has a different rule.

A browser mini golf game: 9 chapters, 38 worlds, 123 holes, each world built around one
mechanic. TypeScript, Three.js and Rapier; a static site with no backend. Requirements
live in [SPEC.md](SPEC.md) (v1, Chapter 1), [SPEC-v2.md](SPEC-v2.md) (Chapter 2),
SPEC v3.0 (Chapter 3), SPEC v4 (Ancient Ruins, built as Chapter 4),
[SPEC-ch5.md](SPEC-ch5.md) (Wild Elements, Chapter 5), [SPEC-ch6.md](SPEC-ch6.md)
(Machine Works, Chapter 6, called SPEC v6 below), [SPEC-ch7.md](SPEC-ch7.md) (City &
Carnival, Chapter 7, called SPEC v7 below), [SPEC-ch8.md](SPEC-ch8.md) (Strange
Dimensions, Chapter 8, called SPEC v8 below) and [SPEC-ch9.md](SPEC-ch9.md) (Monster
Quest, Chapter 9, the last, called SPEC v9 below), which are the source of truth for
scope and milestones. The SPECs for Chapters 3 and 4 are not in this repository.

**Play it: https://mini-golf-3d-self.vercel.app**

## Run

```bash
npm install
npm run dev      # dev server, also reachable from phones on the same Wi-Fi
npm test         # headless engine tests
npm run replay   # play back the reference solution of every hole, and report
npm run build    # typecheck + replay check + production build into dist/
```

Landscape only. Drag anywhere to aim (pull back, release to shoot). On a hole with
walls that turn, a quick tap on a glowing group of walls turns it. A pull that starts
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
| P2 Growing Ball: three sizes, pads, cups that take one size, crates, low bars | done |
| P3 Time Freeze: freeze skill, strokes in mid-air | done |
| P4 Clone Ball: split pads, picking a ball, camera framing every ball | done |
| P5 Golf Bowling: pins, knock-down goal | done |
| P6 Chapter 3 finale: a goal in steps | done |
| P7 sound, music, text, save migration | done; see "Not yet verified" below |
| R2 the works: parts wired by signals, field snapshots, undo, glowing lines, camera showcase | done |
| R3 Pharaoh's Tomb: plates (latch and hold), gates, stones on a grid | done |
| R4 Crystal Cavern: lanterns, crystals, beams, receivers | done |
| R5 Jungle Temple: chains, a bridge, traps that shut the short way | done |
| R6 Dragon's Hoard: gold, alert, the dragon, fire that seals and fire in bursts | done |
| R7 Chapter 4 finale: The Temple Gate | done |
| R8 sound, music, text, save migration to version 4, events | done; see "Not yet verified" below |
| R9 share the link, watch who comes back and who gets stuck | not started |

| V1 forces: currents, bubble columns, wind with shelters; zones told whether the ball is on the ground; the wind on screen | done |
| V2 Reef: 3 holes | done |
| V3 Polar Station: 3 holes | done |
| V4 water works: valves, water moved by valves or by a tide, rafts | done |
| V5 Waterworks: 3 holes | done |
| V6 cracked slabs, of both kinds | done |
| V7 Canyon: 3 holes, and a round of canyon-2 with a stroke taken back | done |
| V8 Chapter 5 finale: From Spring to Canyon, and the `noUndo` challenge | done |
| V9 sound, music, text, save migration to version 5, the Chapter 5 tab | done; see "Not yet verified" below |
| V10 tune against the first playtest | not started |
| W1 machine basics: belts on signals, levers, moving parts on a clock of their own, the `lift` role | done |
| W2 Toy Factory: 3 holes | done |
| W3 robot arms: the pad, the round of drops, the lamp, setting down at rest | done |
| W4 Assembly Line: 3 holes | done |
| W5 the beat: the beat as a signal, gates on it, piano keys, drums, the metronome, music that follows the game's clock | done |
| W6 Music Factory: 3 holes | done |
| W7 time zones: clock switches, rates by signal, the ball bringing slow time with it | done |
| W8 Clockwork: 3 holes | done |
| W9 Chapter 6 finale: Production Line | done |
| W10 sound, music, text, save migration to version 6, the Chapter 6 tab | done; see "Not yet verified" below |
| W11 tune against the first playtest | not started |
| Y1 a tap told from a drag, the `rotate` input, wall groups that turn, the turns left on screen | done |
| Y2 tunnel mouths that turn, each on its lever | done |
| Y3 Subway: 3 holes | done |
| Y4 trains: boarding, points, the run out and back, setting down at rest; a train that crosses the course | done |
| Y5 Railway Town: 3 holes | done |
| Y6 roller coasters: speed reckoned from the entry, loops, rolling back, a track that divides, the gauge | done |
| Y7 Carnival: 3 holes | done |
| Y8 Maze Course: 3 holes | done |
| Y9 Chapter 7 finale: City Day Out, and the `maxRotations` challenge | done |
| Y10 sound, music, text, save migration to version 7, the Chapter 7 tab | done; see "Not yet verified" below |
| Y11 tune against the first playtest | not started |
| Z1 bridges that come and go: the cycle, the warning, the rest rule, the stroke held open, waiting for a ball to leave | done |
| Z2 Phantom Bridges: 3 holes | done |
| Z3 halls with joined edges: the crossing, the ground beyond the line, the picture of the other side | done |
| Z4 Endless Hall: 3 holes | done |
| Z5 the mirror: a shadow ball struck with every stroke, its own rule for leaving the course, what the mirror shows | done |
| Z6 Mirror Maze: 3 holes | done |
| Z7 echoes: zones that hear a stroke and play the one before, echo plates, recordings in the snapshot | done |
| Z8 Echo: 3 holes | done |
| Z9 Chapter 8 finale: Strange Gate | done |
| Z10 sound, music, text, save migration to version 8, the Chapter 8 tab | done; see "Not yet verified" below |
| Z11 tune against the first playtest | not started |
| Q1 two worlds in one place: walls and floors of each, swapped by levers, waiting for a ball to leave | done |
| Q2 Haunted House: 3 holes | done |
| Q3 the grid and its turns: monsters that patrol and monsters that chase, the catch, the arrow | done |
| Q4 Monster Den: 3 holes | done |
| Q5 keys and doors, and the keys in hand on the HUD | done |
| Q6 Dungeon: 3 holes | done |
| Q7 the boss: a goal of its own, the weak spot, the turn, the step, the shield, the hard stop | done |
| Q8 Boss Lair: 3 holes | done |
| Q9 Chapter 9 finale: Demon Castle, the `noCaught` challenge, the end of the game | done |
| Q10 sound, music, text, save migration to version 9, the Chapter 9 tab | done; see "Not yet verified" below |
| Q11 tune against the first playtest | not started |
| S0 an analytics script on the page | not started: it needs a provider account |

SPEC v4 lists R0 (replay check) and R1 (`cup` -> `goal`) first. Both were already done
as P0 and P1.

Not yet verified on real devices: frame rate, touch feel, first-load time on 4G, and
audio on iOS. Everything so far was checked in a desktop browser and in headless tests.
For Chapter 2 that leaves, from SPEC v2 5.2: #5 (occlusion fading on phones) and #6
(the countdown pausing when a phone sends the page to the background). For Chapter 3,
from SPEC v3 5.3: #8 (60 FPS with four balls and fifteen pins), #9 (picking a ball by
tapping it without mis-taps) and, of #3, every browser but Chromium: open the dev build
on the device and press CHECK ALL REPLAYS in the dev panel. For Chapter 4, from SPEC v4
7.3: #8 by hand on a device (a showcase that is skipped changes nothing in a round,
since it only moves the camera, but whether it is pleasant has not been judged), #9
(nobody has played the finale by hand: its reference round was found by search) and
#11 only as far as the texts being present in both languages. No hole of Chapter 4 has
been played by a person yet, so every par in it is a guess. The same goes for Chapter 5,
from SPEC v5 7.4: #5 as far as the wind being shown rightly while aiming on a device,
#8 by eye on a device (the tests measure it: a ball crossing a bridge of slabs is never
more than 6 mm off level nor turned by a thousandth), and #13 only as far as the texts
being present in both languages. Everything in SPEC v5 7.5 is still to be tuned: the
strength of the currents, the wind and how long a gust lasts, the delay of the slabs,
and every par. And for Chapter 6, from SPEC v6 7.4: #11 (whether the music and the
metronome are heard and seen together on a phone: the tests show the notes are put down
within 2 ms of the game's beat, which says nothing of a phone's own audio delay), #4 as
far as looking at it on a device, and #12 only as far as the texts being present in
both languages. Nobody has heard the chapter: its sounds were written, not listened to.
Everything in SPEC v6 7.5 is still to be tuned: the pace of the belts, the round of each
arm, the beat, how hard a drum throws, the rates of the clocks, and every par. And for
Chapter 7, from SPEC v7 7.4: #6 as far as a finger on a phone goes (the rule that tells a
tap from a drag is tested, and a click and a drag with a mouse were tried in a desktop
browser; whether 10 px and 350 ms are right under a thumb has not been tried at all) and
#12 only as far as the texts being present in both languages. Its sounds were written,
not listened to. Everything in SPEC v7 7.5 is still to be tuned: what a loop asks for
and what the track takes off a ball, the speed at the fork, the turns each maze hole
allows, the tap, and every par. And for Chapter 8, from SPEC v8 7.4: #11 (whether the
picture of a hall's far side, the mirror and an echo can be read on a phone, and
whether any of them hides the ball: they were looked at in a desktop browser, where they
can and do not), #6 as far as the camera goes (it was seen to hold both balls, on a
desktop), and #12 only as far as the texts being present in both languages. Its sounds
were written, not listened to. Everything in SPEC v8 7.5 is still to be tuned: how long
a bridge stays and how long it warns, how big a hall is, how unlike the two sides of a
mirror are, whether anyone understands that the last stroke comes back, and every par.
And for Chapter 9, from SPEC v9 7.4: #13 (whether the arrows, the two worlds' tints and
the colours of the keys can be read on a phone: they were looked at in a desktop
browser) and #14 only as far as the texts being present in both languages. Its sounds
were written, not listened to. Everything in SPEC v9 7.5 is still to be tuned: the
grids, how many monsters and how long their paths, how hard a strike on the weak spot
has to be, the length of the last hole, and every par.

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
- **Who the Chapter 4 targets are measured against, and with what.** SPEC v4 7.1 asks
  for 40% of Chapter 2 players to enter Chapter 4 and for at most 20% of players to
  reach the stroke limit on any of its holes. With no provider on the page neither can
  be read. When there is one: `hole_start` on `tomb-1` over `hole_complete` on
  `ch2-finale` is the first; `stroke_limit` over `hole_start` per hole is the second.
  The second undercounts confusion, because a player who is lost restarts or leaves
  long before the limit: read `retry` and `undo` per hole next to it.
- **How anyone gets to Chapter 6.** It opens with the Chapter 5 finale, which on the
  shortest way there is hole 58. SPEC v6 7.2 measures the chapter by the players who
  enter it, and W11 tunes it against a first playtest; nobody in a first playtest will
  be 58 holes in. `?unlock` opens everything, in a development build only. Either a way
  for testers to open a chapter in the live build, or chapters that open sooner, has to
  come before those numbers can mean anything.
- **How anyone gets to Chapter 7.** The same again, and further: it opens with the
  Chapter 6 finale, which on the shortest way there is hole 71. SPEC v7 7.1 says as much
  and sets no targets. Chapter 7 is also the first to ask for something no test here can
  judge at all, a tap on a phone, so it is the chapter that most needs a person to reach it.
- **How anyone gets to Chapter 8.** Once more: it opens with the Chapter 7 finale, which
  on the shortest way there is hole 84. SPEC v8 7.1 sets no targets for that reason and
  suggests a way in for testers (`?chapter=8`). None was built: what a tester's way in
  may open, and whether it writes to the save, is a decision about the game and not
  about this chapter. `?unlock` and `?hole=` still exist in a development build only.
- **How anyone gets to Chapter 9, and to the end of the game.** It opens with the
  Chapter 8 finale, hole 97 on the shortest way. Chapter 9 is the last chapter: nobody
  who has not played 97 holes will see the end. SPEC v9 7.1 records that the user chose
  to keep the unlock order as it is for now.
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

### Where this differs from SPEC v9 (Monster Quest)

SPEC v9 was written against this repository and its premises hold: 110 holes, 1053
tests, save version 8, the unlock order. What follows is what building it settled, or
changed.

- **The two worlds are a part (`realm`) that owns its walls and floors.** SPEC v9 3.3
  speaks of "pieces marked by layer". The ground of a hole is one mesh, which cannot
  come and go in parts, so a floor of one world is a platform that is there or not, as
  a bridge that comes and goes is, and a wall is a collider that is there or not, as a
  gate is. The rest of the house is ordinary pieces, in both worlds.
- **Which world is solid follows from the levers, and is in no snapshot of its own:**
  the ghost world while an odd number of them are on. That is how two levers work one
  swap (SPEC v9 3.3, hole 3). The levers are valves with the look of a lever, as a
  belt's are, and they are what the snapshot holds.
- **The tint is a veil on the floor.** SPEC v9 3.3 asks for the whole hole to change
  colour; the sky and the light are the world's. A warm veil lies over the floor in the
  real world and a cold one in the ghost world, and the world that is not solid is
  drawn see-through with its edges showing.
- **Monsters move together, in the order of the hole's data.** SPEC v9 3.2 has them go
  one after another, by id. Each decides in turn, seeing where the ones before it are
  going, and then all of them walk at once: the same outcome, and a shorter wait.
- **A monster walks over the ball it catches, not into it.** Its body is a wall to a
  rolling ball, and a wall that slides into a resting ball shoves it out of the cell
  before the monster gets there. So a monster stepping onto a ball's cell has no body
  for that step, and catches the ball on arrival. A monster's body fills three quarters
  of its cell and a boss is round, so that neither touches a ball whose middle is in
  the next cell.
- **A ball lying on a monster's cell is caught where it lies.** SPEC v9 3.2 asks for
  that, and a round boss leaves the corners of its four cells for a ball to lie in. The
  monster stamps, and the stroke goes back.
- **A shut door blocks a monster's way across it, not only the cell it stands on.**
  Doors stand on the lines between cells; the rule looks at the middle of the step too.
- **A door opens a few steps before a ball with its key gets there,** as a gate on a
  signal does, so to the ball it is open at once (SPEC v9 3.5) and the picture takes a
  moment. A ball resting against a shut door with the right key in hand opens it too.
- **A key is a part that is held or spent; the ball carries nothing.** The snapshot of
  the works puts a key back on the ground with everything else.
- **The boss is round,** so that turning sweeps no corner into a ball beside it, and
  neither its weak spot nor its shield is there while it moves or where a ball lies: it
  waits for the ball to have gone, as a wall of the ghost world does. The shield comes
  once the ball that struck has bounced clear, not in the same instant.
- **The boss turns to face the ball by where the ball lies, on the grid or off it,** and
  steps only toward a ball on the grid. A ball in the margin of a room, off the cells,
  can still be struck at and still turns the boss; it cannot be caught.
- **A boss hole ends when the ball has stopped,** as SPEC v9 3.6 asks, which is a thing
  no other goal does: a cup ends the round as the ball drops. `Goal.restFirst` says so.
- **The hard stop is in the boss itself:** struck in a stroke, it turns and does not
  step when that stroke ends, whatever its phase.
- **The result says "beaten in", and the last hole says "the end".** A hole with a boss
  is not "holed". The finale of Chapter 9 is the last hole in play order; finishing it
  shows the end of the game, and "all holes complete" only once Chapter 3 is done too.
- **The castle's key room is off the grid.** It lies between the courtyard and the
  throne room, and the one grid of the hole runs through it; every cell of it is
  blocked, so no monster can follow the ball in and no ball there is on any cell.
- **dungeon-2 has no lever.** SPEC v9 3.5 mentions the swap of worlds for its second
  hole in passing; two red doors and one red key make the order matter on their own.
- **The sound of a monster's step is the game watching it,** like a train's. No event
  was added, as the SPEC says.
- **Pars are from search again.** The thirteen reference rounds take 2, 3, 4, 1, 2, 2,
  2, 4, 3, 1, 2, 5 and 10 strokes against pars of 3, 4, 5, 2, 3, 4, 3, 5, 4, 3, 5, 7
  and 12. lair-1 and lair-2 lean on strokes very few players will find: a bank off two
  walls onto the weak spot, found in one try of five hundred. SPEC v9 7.5 leaves the
  tuning to the playtest.
- **Scenery is built in code.**

### Where this differs from SPEC v8 (Strange Dimensions)

SPEC v8 was written against this repository and its premises hold: 97 holes, 896 tests,
save version 7, the unlock order. What follows is what building it settled, or changed.

- **A bridge that comes and goes is a moving part, not one of the works** (`phantom` on
  a mover). SPEC v8 3.2 leaves the choice open, because waiting for a ball to leave
  makes the bridge depend on the ball. It needs one thing remembered, whether it is
  there, and that follows again from the clock and the ball within a tick of anything
  being put back. So it is in no snapshot and brings no undo, as the SPEC asks.
- **Gone, a bridge is switched off, not made a ghost.** A platform that is only not
  there for the ball can still be found by the ray that looks for the ground, and a
  ball over the gap would be rolling on nothing.
- **"In its place" means sunk into it by more than two centimetres.** A ball lying on
  the bank at a bridge's end is four millimetres into where the bridge will be, as with
  any platform. If that kept the bridge away, the stroke onto it would fall.
- **phantom-3's island is dust.** SPEC v8 3.2 lets a ball stop "on safe fixed ground".
  A ball that has just ridden three bridges does not stop on three metres of stone.
- **There is no pause after a crossing.** SPEC v8 5 asks for one, against a ball going
  back and forth over a line. A ball is taken across only while it is going out over
  the line, and it arrives going in, so nothing sends it straight back; a pause could
  only let a fast ball in a small hall run off the far edge with nobody to catch it. The
  test asks for what the pause was for: no two crossings of one pair of edges ever come
  nearer together than the hall is wide.
- **A ball crosses just after the line, on real ground.** It is taken across on the
  first step after its middle has passed the line, so the ground goes on beyond every
  joined edge: a skirt of pale ground, 2.5 m of it, of which a ball uses a third of a
  metre. The picture of the other side is drawn on the skirt.
- **"Built alike at both edges" is a test, and says something exact:** wherever a ball
  can be just past a joined line, it can be in the place it is taken to, and there is
  ground under both. So a wall that meets a joined edge runs on across the skirt, and
  the pen of hall-3, whose side ends at the right-hand edge, comes in again 0.6 m at
  the left.
- **The camera does not jump at a crossing, because it does not move.** SPEC v8 3.3
  sends the camera after the ball at once. While the ball is in a hall its four corners
  are kept in view, so the picture is the same before and after. The cut is still made,
  for a hall too big for that.
- **The picture of the other side is its walls, the cup and the balls,** cut off at the
  edge of the skirt. Not its floor, and not its works. A ball rolling up to a line can
  be seen coming toward the far one.
- **The mirror is a picture, and a wall of glass stands under it.** SPEC v8 3.4 says the
  balls pass through each other, which balls here always have. What keeps each on its
  own side is a wall, and a test goes round every mirror hole to see that it does.
- **The shadow is a ball in play that is not the player's** (`BallSet.shadow`). Zones,
  plates, levers and walls all meet it. It is left out of picking a ball, of the cup, of
  what a challenge counts, of "a ball that leaves while another plays on is gone", and
  of the wait for balls still rolling once the hole is won.
- **The player's ball out of bounds takes the shadow back too,** to where the stroke
  found it: that is the snapshot. The shadow out of bounds goes back alone, and whatever
  it pressed on the way stays pressed.
- **A mirror can be told what it shows** (`reach`). Only a stroke played from inside it
  sets the shadow off. That is how the finale keeps the shadow still until the ball is
  in front of the mirror, and still again among the echoes (SPEC v8 3.6). The mirrors
  of the world's own three holes show everything.
- **The shadow has an arrow of its own while the player aims,** the player's turned
  round in the glass, and a ring round it between strokes. Not in the SPEC; without it
  the first stroke of the world is a guess.
- **mirror-3 pins the shadow.** SPEC v8 3.4 wants the shadow standing on a plate while
  the ball goes through the gate; but the stroke that takes the ball through moves the
  shadow too. The plate lies in a nook at the far end of the shadow's room, carpeted
  and soft-walled: a stroke up the room presses the shadow into it and keeps it there.
  So the stroke through the gate has to be one that goes up the room.
- **Only an echo presses an echo plate.** SPEC v8 3.5 says a plain plate is for the
  ball alone, and of the silver one only that an echo can press it. If a ball could as
  well, a ball stopped on it would open its own gate.
- **An echo is one stroke late, and that decides how the holes are laid out.** It sets
  off when the next stroke is played and gets to a plate when the ball did. A ball that
  starts where its echo will end is therefore always ahead of it: with the gate beyond
  the plate, the ball is there first every time. So echo-1 has its plate by the tee and
  its gate far off; echo-2 and echo-3 send the echo one way and the ball back the other.
- **echo-3's plates stay down.** SPEC v8 3.5 has one stroke lay two stretches of echo.
  An echo is in one place at a time and cannot hold two plates, so both latch, and the
  gate wants both.
- **A stroke that barely leaves the plate has an echo that never does.** That is the
  patient way through echo-2, a stroke dearer than the timed one; a test plays it.
- **A stroke taken back, or ended out of bounds, is not heard.** The snapshot holds
  which stroke is being played back, since which tick, and which was heard last. A
  recording is never changed once its stroke is over, so the snapshot keeps the thing
  itself and not a copy. How far the playing has got is the hole's clock.
- **An echo still running does not hold the stroke open.** It runs on while the player
  aims, like a moving part, and the next stroke puts another in its place.
- **The path of the last stroke is drawn across the zone in dots:** what the next
  stroke will set going. Not in the SPEC.
- **A gate on an echo plate answers in eight ticks,** not in the time the glow takes to
  run down the line. An echo is late enough already.
- **The echo holes name a point to keep in view** (`camera.keep`): the plate lies the
  other way from the cup, and the camera frames the ball and the cup.
- **The finale has two bridges, and moss beyond its silver plate.** A second bridge
  between the first gate and the echoes keeps "never out of bounds" from being settled
  on the first stroke. The last gate costs a stroke of waiting when the stroke before
  was a long one, for the reason above: its reference round takes 7.
- **The sound of a bridge coming and going is the game watching a moving part,** and
  the sound of the shadow on a plate is the plate's own cue with the shadow standing
  there. No event was added, as the SPEC says.
- **Pars are from search again.** The thirteen reference rounds take 1, 2, 2, 1, 1, 2,
  2, 3, 4, 2, 2, 2 and 7 strokes against pars of 2, 3, 3, 2, 3, 3, 3, 4, 6, 3, 3, 3 and
  8. hall-3 can be holed in one by a stroke that crosses twice; mirror-1 in one off a
  wall. SPEC v8 7.5 leaves the tuning to the playtest.
- **Scenery is built in code.**

### Where this differs from SPEC v7 (City & Carnival)

SPEC v7 was written against this repository and its premises hold: 84 holes, 740 tests,
save version 6, the unlock order. What follows is what building it settled, or changed.

- **A tunnel that turns is one of the works, not the old tunnel with a signal.** SPEC v7
  4 has `tunnelPair` take its facing from a signal. `tunnelPair` is a zone, and a zone
  hears no signals and is in no snapshot. So a turning tunnel is a part (`tunnel`),
  stepped by the very code the zone runs on (`stepTunnel`): the 84 old holes still end
  on the same bit. Its kiosks are its own colliders, and so are its levers.
- **A mouth's lever is its own, with as many throws as the mouth has facings.** The
  SPEC reuses `lever`, which is a valve and has two. A mouth with three ways to face
  needs three, so the tunnel keeps count itself, the way a crystal does.
- **A stroke is not over until the train is home.** SPEC v7 3.3 ends it when the ball
  is set down. The train then runs back empty, twice as fast as it went, and the stroke
  waits for it, with the camera left on the ball. That way a snapshot is always of a
  train at its platform, the points are never thrown under a moving train, and no ball
  can be lying on a platform when the train gets back to it.
- **There is no rest rule for trains, because there is nowhere to rest.** SPEC v7 3.3
  asks that a ball may not stop on a train or on its track. The wagon is no collider,
  a ball aboard is out of the simulation, and every stretch of track runs over open air;
  a test goes along each one and fails if any of it lies over the course. The train
  that crosses the course in rail-3 is a moving part, and has the usual rule.
- **A ball set down on a platform is taken aboard.** That is how rail-2 hands a ball
  from one train to the next in a single stroke. A line may not set a ball down on its
  own train's platform, and a train needs one line that no lever has to be thrown for.
- **Any climb a ball is too slow for sends it back, not only a loop.** SPEC v7 3.4
  speaks of the top of a loop. Here one rule covers both: at every point of the track
  the ball has to have the speed to be there. On a climb that is any speed at all; on
  the upper half of a loop it is enough to stay on, which at the very top is gravity
  times the radius, as the SPEC says. A ball that falls short rolls back from where it is.
- **What the track takes off a ball is a steady slowing, 0.6 m/s² all the way along.**
  The SPEC allows "a fixed loss". A ball on the track never moves slower than 0.8 m/s:
  it creeps over a crest it only just makes, and creeps home from a stall.
- **The gauge has a needle.** SPEC v7 3.4 asks for a mark of the least speed at the
  entry. The gauge is red below that speed and green above, and its needle swings to
  the speed the last ball came in at, so a stroke that fell short shows by how much.
  Nothing is drawn on the power bar.
- **The fork is judged at the fork**, from the speed the ball came in with, not from
  where the last step happened to leave it. So the mark is the same on every device.
- **The Carnival is looked at from one side.** From behind the ball a loop is a line.
  Its three holes turn the view 38 degrees; the player can turn it back.
- **fair-2's middle platform is walled.** SPEC v7 3.4 asks for two strokes that each
  have to be judged. They are: the second loop is the bigger and wants more, from less
  of a run. A platform a ball could also fly off was one judgement too many for a
  second hole. fair-3 has the open edge, with sawdust before it.
- **A wall group is in its new place at once; only the picture takes time,** as with a
  gate since Chapter 4. For those 14 ticks no stroke can be played and no other group
  turned, as SPEC v7 5 asks. It is safe because a group cannot be turned while a ball
  lies anywhere within reach of its arms: not only where an arm is, but anywhere one
  passes.
- **A press that is held is nothing.** SPEC v7 3.5 gives two outcomes, a tap or an aim.
  There are three: a press that never moved 10 px and ended within 350 ms is a tap; one
  that moved is an aim; one that stayed put for longer is neither a stroke, as before,
  nor a tap. Turns are few, and a finger that came down to aim and thought better of it
  must not spend one. Picking a ball in Chapter 3 still takes any press on the spot.
- **A tap counts within a fingertip of a group's reach:** 22 px beyond the circle its
  arms sweep as it looks on screen, and never less than 48 px from its pivot. Where two
  groups' targets overlap the nearer pivot wins. A tap anywhere else does nothing.
- **A turn made before the first stroke cannot be taken back.** Undo takes back a
  stroke, and with it the turns made since (SPEC v7 3.5). Before the first stroke there
  is none to take back: turns wasted then are got back by RETRY.
- **`maxRotations` counts the turns that stand when the hole ends,** like every
  challenge since Chapter 4: a turn that went back with its stroke is not counted.
- **Rooms in the maze have a stub of hedge at the middle of each wall.** An arm that
  points at one closes the gap between it and the pivot, so a bar divides a room into
  halves, an L cuts one quarter off, and a T two. The stubs also leave room round the
  edge for a ball to wait clear of the arms while they turn.
- **In maze-2 it is which way each group stands that matters, not the order they are
  turned in.** SPEC v7 3.5 has the order decide the route. Groups do not get in each
  other's way, so order alone decides nothing. maze-3 is where order tells: its first
  room is a revolving door, and whether the ball is moved before or after the turn is
  the difference between one turn and two, with two for the whole hole.
- **rail-2 has a third train, and one lever starts thrown.** A wrong setting of the
  points ends at a depot, and from there a train brings the ball home in the same
  stroke: a mistake costs the stroke and shows the whole network. With both levers
  starting off, the answer would have been "throw everything".
- **subway-2's wrong way looks like the right one.** North is a pen beside the cup with
  a wall between; east is the long way round, and the only way there.
- **The sound of the passing train is the game watching a moving part,** like a piano
  key's note: the round has no cue for it. No event was added, as the SPEC says.
- **Pars are from search again.** The thirteen reference rounds take 2, 3, 3, 2, 3, 3,
  1, 2, 1, 1, 3, 3 and 6 strokes against pars of 3, 4, 5, 3, 5, 4, 3, 4, 4, 2, 5, 5 and
  8. Some of them lean on a stroke few players will find: rail-2's throws both levers
  with one ball. SPEC v7 7.5 leaves the tuning to the playtest.
- **Scenery is built in code.**

### Where this differs from SPEC v6 (Machine Works)

SPEC v6 was written against this repository and its premises hold: 71 holes, save
version 5, the unlock order. What follows is what building it settled, or changed.

- **A stroke can be taken back where a ball can change the works, not wherever there
  are works.** SPEC v6 3.1 keeps the old rule, undo "only on a hole with works", and
  says the Music Factory has none; but its gates are Chapter 4 gates, which are works.
  All three cannot hold. The rule is now what the old one was for: a hole has undo if
  its works hold something a ball can change (a lever, a clock switch, and every part of
  Chapters 4 and 5). Works that only keep time, a gate on the beat or a belt with no
  switch, bring no undo, are left running when a stroke is put back, never hold a stroke
  open and are never something for the camera to go and show. Every hole that had undo
  still has it, and a test says so.
- **Piano keys are a lift, not steps to climb one at a time.** SPEC v6 3.4 has keys
  rising and falling in turn to make moving stairs. A ball here has no grip and may not
  be left on a key, so it cannot stand on one step and wait for the next. A run of keys
  is one block instead: level with the floor before it for two beats, rising for two,
  level with the floor after it for two, coming down for two. The ball has to roll onto
  it as it is about to rise and still be on it when it gets there. That is a new role of
  moving part, `lift`: rolled onto like a platform while it is level, a wall while it
  stands higher than the ball. Its motion is the old `slide` with pauses, counted in
  beats; no new kind of motion was needed.
- **clock-2 needs its two clocks to disagree, either way round.** SPEC v6 3.5 asks for
  one set of machines slowed and the other sped up to make a way through. Where nothing
  has grip, nothing ever needs a machine to be fast: slowing one never shuts a way, it
  only makes the wait longer. So the hole is two swing bridges end to end that are never
  both in place while their clocks keep the same time, and drift into step as soon as
  one switch is knocked. One slow and one fast is the answer with the longest openings,
  not the only one.
- **A rate changes over a few ticks, an eighth at a time.** SPEC v6 3.5 asks only that
  no machine jump, which a change of rate never causes. Easing the rate as well keeps a
  machine from lurching, and rates being whole eighths keeps a zone's clock an exact
  number in every browser. A rate that is not a whole number of eighths will not build.
- **A robot arm catches like a cannon, and its lamp is the rim of its pad.** SPEC v6 3.3
  gives the pad a low rim to stop the ball. Nothing here stops a ball but a wall, so a
  ball that rolls onto the pad is simply taken hold of, at any speed, and waits. The rim
  is drawn: it is the colour of the drop the next trip goes to, and burns down like a
  fuse to the moment that trip leaves, which is the half of the timing a lamp alone
  would not show. An arrow over the pad points at the drop too. The arm stands outside
  the course and is not a thing a ball can run into.
- **A drum is forgiving.** It strikes for six ticks, but a ball rolling gently is on its
  skin for most of a second, so nearly any slow roll across one is thrown. A ball is
  thrown with the drum's own velocity less one tick of the ground's hold, always the same.
- **A gate on the beat never shuts on a ball.** Like every gate since Chapter 4 it waits
  for the doorway to clear. For that one beat it is behind the lamps above it.
- **The music is told the game's clock, and writes its notes a fifth of a second
  ahead.** That is what "the music follows the game" came to: nothing in the game reads
  the audio clock. If the game stops, the notes already written still sound, a beat at
  most. A beat is 30 ticks, which halves but does not quarter, so the tune moves in
  half beats.
- **The finale's third star is about the piston.** `noMoverHits` counts moving parts a
  ball can run into, and on that hole there is one. The arm, the belt and the drum
  cannot be run into; a gate that is shut is a wall.
- **toy-2's wrong way is the edge.** SPEC v6 3.2 has the pair of belts choose which way
  the ball is sent. One way is the cup; the other is off the end of the line, which
  costs a stroke and puts the ball back, levers as they were when it was struck.
- **A belt takes half a second to turn round and holds the stroke open while it does.**
  So a snapshot is never of a belt half way round.
- **A time zone can also take its rate from signals** (`rates`, like the `levels` of
  water), as SPEC v6 3.5 allows. No hole uses it.
- **The wind meter no longer stays on screen after a hole with wind.** A Chapter 5
  fault, found while adding the metronome beside it, which had the same one.
- **Pars are from search again.** The thirteen reference rounds take 2, 3, 4, 2, 2, 3,
  1, 2, 2, 2, 2, 3 and 6 strokes against pars of 3, 4, 5, 3, 3, 4, 2, 4, 4, 3, 4, 5 and
  7. SPEC v6 7.5 expects this and leaves the tuning to the playtest.
- **Scenery is built in code**, and no event was added, as the SPEC says.

### Where this differs from SPEC v5 (Wild Elements)

SPEC v5 was written against this repository and its premises hold. What follows is
what building it settled, or changed.

- **A zone is told where the ball was a step ago.** `ZoneContext.grounded()` is the
  round's own reading from the last step, since zones run before the ground is looked
  for. One step late and the same for everyone. Before the world has stepped at all no
  ray finds anything, so on the very first tick the reading is left as it was: without
  that, a ball on the tee counted as in the air for one tick and the wind gave it a nudge.
- **A ball in a current settles a little under the water's pace,** about four fifths of
  it, because the ground still slows a rolling ball there as anywhere. "No faster than
  the water" holds; "as fast as the water" does not.
- **Every gust lasts as long as every other.** SPEC v5 4.1 allows each its own length;
  one `period` for all was enough for thirteen holes and is easier to read on screen.
- **A bubble column leaves a ball alone for two seconds after letting it go,** not the
  half second of a cannon: a ball let go slowly takes that long to come down and roll
  clear of the foot.
- **Polar holes have snow drifts to land in, and ditches that are floors.** Neither is
  in the SPEC. A ball that comes down from a jump is doing 6 m/s or more and rolls on
  for as many metres, off the far side of anything it landed on; `drift` is a surface
  that stops it where it lands. A ditch is a floor lower down with an out-of-bounds box
  over it, so that the fence of polar-3 has something to stand in.
- **A valve can reach down into its pool** (`depth`), to be struck from a raft lying
  low as well as from the bank. Without it a ball that rolled onto the raft before the
  pool was filled had no way out but undo.
- **A ball drowns when its middle goes under.** The SPEC says only that water is out of
  bounds. A ball on a raft, or on ground a little above the surface, is dry.
- **Water answers its valves at once.** The levels of a `water` are tested each tick,
  with none of the delay a Chapter 4 part has while a signal runs down its line; and no
  line is drawn from a valve to its water.
- **A slab with a delay holds the stroke open until it has fallen.** So a ball can never
  be struck from one, and the place a lost ball returns to is never a slab about to go.
- **"Left" means no longer above the slab.** A ball that hops on it has not left.
- **Out of bounds with no stroke under way takes the last stroke back,** on a hole with
  works. In Chapter 4 only the ball was put back in that case. With slabs that fall when
  the ball leaves them, the place it is put back to may no longer be there. Nothing in
  Chapter 4 reaches this case: its rest rules keep a resting ball out of fire.
- **canyon-2 has a plate and a gate from Chapter 4.** SPEC v5 6 keeps Chapter 3's
  mechanics out of this chapter and says nothing of Chapter 4's. Three bridges alone
  did not make an order that matters; a cup shut in until a plate is pressed did.
- **The round of canyon-2 with a stroke taken back is a test, not a second replay
  file.** `replays/` holds exactly one round per hole, each within par with its third
  star. `tests/wild.test.ts` plays the wrong bridge, takes it back and finishes.
- **dam-2 can be finished both ways, and both are played:** over the raft at high water
  in its reference round, along the bottom at low water in a test.
- **Nothing was done about analytics (S0).** It needs an account with a provider and
  one script tag in `index.html`; the events are already sent to whichever is there.
- **Pars are from search again.** Seven of the thirteen reference rounds are a hole in
  one or two. SPEC v5 7.5 expects this and leaves the tuning to the playtest.

### Where this differs from SPEC v4 (Ancient Ruins)

SPEC v4 was written as "Chapter 3" on the belief that the original Chapter 3 had been
put off. It had shipped. The differences that follow from that come first.

- **It is Chapter 4, and the game has 58 holes.** Growing Ball, Time Freeze, Clone Ball
  and Golf Bowling stay where they are as Chapter 3. Several balls, skills and the
  `knockdown` goal, which the SPEC lists as things not to build yet, already existed.
- **Saves move to version 4** under `minigolf.save.v4`, not to version 3. The version 3
  save is left as it was.
- **Chapter 4 opens with the Chapter 2 finale, beside Chapter 3,** not after it
  (`ChapterDef.after`). That is what the SPEC says in words ("after the Chapter 2
  finale"), and it keeps the new chapter from sitting behind 45 holes. PLAY goes to the
  first hole in play order that is open and has no score; "all holes complete" waits
  for every hole, not for the last one in the list.
- **A stroke can be taken back (UNDO), for the price of a stroke.** Not in the SPEC. A
  stone can only be pushed, so one shoved into a corner cannot be got out again, and
  without this the way out of a dead end would be to restart the hole or to hit the
  ball out of bounds on purpose. Undo is that same out-of-bounds rule with a button: the
  ball and the course go back to before the stroke, plus one. Only holes with works
  have it. The Z key does the same.
- **Going back puts the dragon back to sleep.** SPEC v4 3.6 says a dragon that has woken
  never sleeps again; 3.8 says the snapshot holds the alert and the dragon. Both cannot
  hold. The snapshot wins: a stroke that is taken back, or ends out of bounds, never
  happened. The dragon never goes back to sleep by itself.
- **Challenges are judged by how the course stands at the end,** not by what happened
  along the way, for the same reason: gold picked up in a stroke that was taken back is
  not held, and a dragon woken in one is asleep.
- **The camera never leaves a rolling ball.** SPEC v4 3.2 turns the camera to a part the
  moment it is triggered, with the physics running on, which hides the ball while it is
  moving. Here the plate sinks, the line lights and the sound plays at once; the camera
  goes to look only when the ball has stopped, at each part that changed out of sight,
  for 1.4 seconds each, the first time it happens on a hole. Starting to aim skips it.
  While a ball waits for a chain to finish, the camera watches the part that is moving.
- **A stroke is not over until the works have stopped moving.** So a snapshot is always
  of a course at rest, and the next stroke never starts with a bridge half way up.
- **Parts are wired by signal, not by trigger and action lists.** SPEC v4 4.2 sketches
  `TriggerDef`, `ActionDef` and `LinkDef`. A hold plate is a level, not an event: with
  open and close as actions, two plates on one gate would fight. Instead every part has
  a signal (a plate while pressed, a gate once open, a block once arrived) and a part
  that reacts names the signals it listens to with `when`, all of some and none of
  others. A chain is parts listening to one another. It is still all data: no hole has
  logic of its own, and a new kind of part is one registration.
- **A crystal sends light on the way it points.** It is not a mirror. Which way the
  light leaves does not depend on where it came from, so the arrow on the ground under a
  crystal is the whole story. Its facings are a list it steps through, not always 45
  degrees apart.
- **A stone moves away from the side that was struck,** not along the ball's main
  direction of travel. The side is something the player can see; near a diagonal the
  direction of travel flips between two answers on a hair.
- **A gate is open or shut at once for the ball; only the picture takes time.** If a
  shutting gate were a moving wall, a hard enough stroke off a hold plate would beat
  it through.
- **Fire has a rest rule, like a moving part.** A ball that stops where fire can burn is
  moved to a safe spot the hole names. Otherwise it would burn, be put back where it
  was struck from, which is that same spot, and burn again.
- **The finale's goal is a plain cup.** The SPEC makes it a `sequence`. Its gates stand
  in the way of each other, so the order needs no rule; a `sequence` of steps is for
  goals that are not places, like pins.
- **The switched-zone action was not built.** Nothing in the chapter needs a zone that a
  signal turns on, other than fire, which is a part of its own.
- **On the dragon holes the gold is off the way to the cup.** SPEC v4 3.6 puts the
  gold on the short way, which makes going for it and going for the cup the same
  stroke. In hoard-1 and hoard-3 the cup is straight ahead with nothing in the way, and
  the gold is to one side between the bells: it costs strokes as well as risk, and a
  round that leaves it finishes sooner with two stars (`tests/ruins.test.ts` plays
  both). hoard-2 keeps the SPEC's shape: its gold lies toward the near door.
- **Scenery is built in code,** as before: no CC0 kits.
- **Solutions were searched for, with a tool that is in the repository this time:**
  `src/debug/search.ts`. Many of them are a hole in one or two. They prove a hole can
  be done within par with its third star, not that the par is fair.

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
- **Saves move to a new key.** Version 3 is written under `minigolf.save.v3` and the
  version 2 save is left as it was, as the version 1 save was before it. A version 2
  build does not understand a version 3 save and would start the player from nothing,
  so after a rollback it must still find its own.
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
             zones (among them currents, bubble columns, wind, robot arms, drums, roller
             coasters and halls with joined edges), movers (among them bridges that come
             and go), loose props (crates, pins)
  level/     chapter, world and hole data schema, compiler (data -> geometry), physics builder
  game/      session state machine, rules, goals (cup, pins, steps, a boss), the set of
             balls (and the shadow ball of a mirror), skills, challenges, replay
  game/field/  the works of a hole: plates, gates, stones, light, sliders, gold, the
             dragon, fire, valves, water, rafts, cracked slabs, belts, clock switches,
             time zones, the beat, tunnel mouths that turn, trains, wall groups the
             player turns, echo zones and echo plates, the two worlds of a haunted
             house, monsters, keys and doors, the boss; how they pass signals; the
             snapshot a stroke goes back to
  input/     slingshot aiming, a tap told from a drag, and camera gestures on Pointer Events
  render/    Three.js scene, camera, course, ball, zone and mover views, the views of
             the works and the lines between them, the picture of a hall's far side,
             the mirror, the ghost world, the monsters, scenery, occlusion fading, quality tiers
  audio/     synthesised sound effects and generated music, and music that keeps a hole's beat
  ui/        HTML/CSS HUD and menus, all interface text (en / zh)
  debug/     development panel, and the stroke search the reference solutions are found
             with (not included in production builds)
  data/      surfaces, themes, the thirty-eight worlds, the nine finales and the chapter
             list (content only, no logic)
tests/       determinism, tunneling, seams, terrain, rules, scoring, movers, fields, saves,
             save migration, tunnels, the moving cup, countdown, rooftops, ball sizes,
             time freeze, clones, bowling and goals in steps, the works (field) and the
             Chapter 4 holes (ruins), forces and water works (elements) and the Chapter 5
             holes (wild), belts, arms, the beat, drums and time zones (machines) and the
             Chapter 6 holes (works), music on the beat, turning tunnels, trains and
             coasters (city), taps and wall groups (maze) and the Chapter 7 holes (town),
             bridges that come and go, joined edges, the shadow ball and echoes (strange)
             and the Chapter 8 holes (dimensions), the two worlds, monsters, keys, doors
             and the boss (quest) and the Chapter 9 holes (castle), reference solutions
replays/     one reference solution per hole: its inputs and how the round ended
scripts/     the replay command and the dev server's SAVE REPLAY endpoint
```

## Adding content

A **hole** is one object in a world file under `src/data/worlds/`: tee, goal (a cup,
pins, steps of them, or a boss), par, pieces (floors, ramps, walls, pillars, low bars), zones,
movers, crates, skills, works (`field`: parts wired by `when`, and how many `turns` of a
wall group it allows), a `beat` if its machines keep one, a `mirror` if it has a shadow
ball, an optional third-star challenge. Nothing outside that file
changes, except that it needs a reference solution in `replays/` (see below).
`tests/worlds.test.ts` then checks it automatically.

A **world** is a new file there plus one line in `src/data/chapters.ts`, and, if it
wants its own look, entries in `src/data/themes.ts` and `src/data/surfaces.ts`.

A **chapter** is one more entry in `src/data/chapters.ts`: its worlds and its finale,
and, if it should open from a chapter other than the one before it, `after`. Menus,
unlock order and saves all follow from that list.

A **new mechanic** is a module, registered by name so data can refer to it:

| Kind | Where | Example |
|---|---|---|
| Surface (what the ground does) | `src/data/surfaces.ts` | ice, sand |
| Zone (a region acting on the ball) | `src/physics/zones/` | magnet, gravity, launcher, pads, current, wind, arm, drum, coaster, wrap |
| Skill (something the player does on purpose) | `src/game/skills.ts` | freeze |
| Zone visual | `src/render/zoneViews.ts` | magnet rings, cannon |
| Mover motion | `src/physics/movers.ts` | slide, swing, spin |
| Mover role (what a moving part is to the ball) | `src/physics/movers.ts` | platform, pusher, lift |
| A mover that comes and goes | `src/physics/movers.ts` | `phantom` on any mover |
| Challenge check | `src/game/challenges.ts` | noWallHits, firstStrokeInto, maxRotations, noCaught |
| Scenery model | `src/render/decor.ts` | canopy, tower, gear |
| Part (one of the works of a hole) | `src/game/field/` | plate, gate, stone, crystal, fire, valve, water, belt, dial, timeZone, pulse, tunnel, train, rotor, echo, echoPlate, realm, monster, key, door, boss |
| Part visual | `src/render/fieldViews.ts`, `src/render/cityViews.ts`, `src/render/strangeViews.ts`, `src/render/questViews.ts` | the gate slab, the dragon, a train and its track, an echo, a monster |

A zone talks to the game through `ZoneContext` only: it can move the ball, hold it
(`busy`), say that it jumped (`snap`), add time to the countdown (`addTime`) and name
a moment for sound and effects (`emit` a cue), make the ball a size bigger or smaller
(`resize`), split it in two (`split`) and ask whether it is on the ground (`grounded`). With several balls on the course a zone is
run once per ball, so one that remembers something about a ball keeps it per ball
(`perBall`). Challenges can count cues. A zone that acts by itself on whatever lies in
it, like a drum, says where a ball may not be left (`forbidsRest`), as a moving part does.
A zone's picture is told the hole it is in and, each frame, the balls in play: a hall
with joined edges draws both.

A part talks to the round through `FieldHost` only, and to other parts through signals:
it has `on` (what others listen to), `busy` (still moving, so the stroke is not over)
and `save`/`load` (its state, for the snapshot). A part that reacts to others holds a
`Drive`, which works out when the signal named by its `when` has arrived. A part that
keeps the hole's clock and nothing else says so (`timed`); a part that keeps a clock of
its own for moving parts to run on has `at` (a `LocalClock`), and a moving part names
it with `clock`. A part can take hold of a ball as a zone can (`hold`, `snap`): a train
does. A part the player works by hand has `turn` (a `Turnable`): the round gives it its
turns, counts them and records each as an input. A part that has to know of strokes is
told when one is played (`struck`, after the snapshot is taken), when every ball has
stopped (`stopped`, once a stroke, and the stroke waits for whatever it sets moving)
and when it is over (`rested`): an echo zone is, and a monster takes its step at
`stopped`. A part that stands on cells of the grid says which (`cells`), so that
another may not step onto them.

`physics/`, `level/` and `game/` never mention a specific world.

## Development tools

The dev server adds a **DEV** button (bottom centre) that opens a panel to jump to any
hole, unlock everything, draw the physics colliders and zone volumes, replay the
strokes of the current round, check that a replay is identical 10 times over, and tune
feel values with sliders. **COPY CHANGES** exports whatever was changed as JSON.

URL switches, development only: `?hole=ice-2` starts on that hole (`ch1-finale` to
`ch9-finale` are the finales), `?unlock` opens every hole in every chapter. `?lang=zh`
or `?lang=en` forces a language in any build.

### Reference solutions

Every hole has one in `replays/<holeId>.json`: the inputs of a round that finishes it
(each stroke's tick, direction, power and ball, each use of a skill, each turn of a wall
group) and how that round ended. `npm run replay` plays all 123 back without rendering, in about a second,
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
  which writes the file through the dev server, or look for a round with
  `searchStroke` from `src/debug/search.ts` in a throwaway test and record what it
  finds with `npm run replay -- --import <file.json>`;
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
- **A snapshot is taken where the ball's return point is set, and nowhere else:** on a
  stroke from the ground. Out of bounds and undo both pop the newest one. An
  out-of-bounds with no stroke under way puts the ball back and leaves the course alone.
- **Fire in bursts keeps the hole's clock, and the clock is not in the snapshot.** Going
  back a stroke does not rewind a burst, as it does not rewind a moving part.
- **An open gate has no collider at all** (it is switched off, not ghosted): the ray
  that looks for the ground under the ball would otherwise find the gate it is rolling
  through.
- **A stone is a kinematic body moved one square at a time.** Its position is read back
  from the physics engine, in the engine's own single precision.
- **Light is traced when a crystal turns, not every tick,** and gives up after eight
  stretches or on meeting a crystal twice.
- **A current pulls toward a velocity; it never pushes.** Each step the ball's speed
  along the ground is brought a share nearer the water's. A push would make it one more
  gravity zone, which is exactly what the Reef is there not to be.
- **Wind and tides keep the hole's clock and are in no snapshot,** like moving parts and
  bursts of fire. Water moved by a valve is in it.
- **A raft goes up and down and nowhere else.** Nothing here has grip, so a raft that
  drifted would slide out from under the ball.
- **Slabs and rafts are platforms** (see below): proud of the ground by 4 mm, there only
  for a ball that is over them, and overlapping whatever they join by a tenth of a
  metre. Slabs that meet overlap each other the same way. A slab that has fallen is
  parked forty metres down rather than removed.
- **Where a current ends and where a column lets go must be somewhere a ball can
  stop.** A test plays two dozen strokes on every hole with water in it and fails if
  one never ends, or if the ball is picked up again while the player aims.

- **A belt is a current that can be turned round.** Both bring a ball's speed along
  the ground a share nearer their own each step, with the same few lines of code
  (`carry` in physics/zones/water.ts). A belt is one of the works, because a signal
  turns it; a current is a zone, because nothing does.
- **A time zone's clock is a sum of rates, one a tick.** A moving part that names it is
  where its motion has it at that clock's time, which is why a change of rate can never
  make it jump: the time it shows does not change, only how fast it goes on. The clock
  is in no snapshot; the switch that sets its rate is.
- **A moving part is built before the works are.** One that keeps a zone's clock reads
  the hole's own on tick 0, when the two still agree, and the session forgets the works
  of the round before first, so a retry cannot ask a clock that is gone.
- **The beat is a count of ticks, and a gate on it answers on the very tick** (a `delay`
  of 1). With the usual delay, the time a glow takes to run down a line, a gate would
  be a few ticks behind the lamps.
- **A robot arm and a drum are functions of the tick** (`armAt`, `drumAt`), like a
  moving part. What they hold is the only state they have, and it is per ball.
- **A ball held by an arm is out of the simulation**, like one in a cannon: its body is
  switched off and moved by hand, so it meets nothing on the way across.
- **The music never drives anything.** `BeatPlayer` is told the game's tick each frame
  and schedules ahead of it. Do not make a machine wait for a sound.

- **A turn of a wall group is an input, like a stroke.** It is recorded with its tick
  and the group's id, and played back on that tick. A replay file from before Chapter 7
  has none and plays as it always did.
- **A tap is judged in the input layer, by wall-clock time, and never by the
  simulation.** What reaches the round is only that a group was turned, and on which tick.
- **A coaster reckons, it does not integrate.** A ball's speed at a point of the track
  is worked out from the speed it came in at, the height of the point and the length of
  track behind it. Stepping only says how far along it has got. That is why one speed
  at the entry gives one ride, whenever it is taken; and the track is laid out with
  `core/math.ts`, like everything else a replay passes through.
- **A loop is 32 points, one of them the very top,** and every point a ball passes in a
  step is tested, not only where the step ends. Otherwise a fast ball could step over
  the one place that would have stopped it.
- **A train's points follow the levers at once,** like water and its valves: there is
  no line on the ground for a signal to run down.

- **A bridge that comes and goes is a function of the tick and of one thing more:**
  whether it is there. It comes back only into empty air, so for a tick or two after
  its time it may still be away. That is settled before the world steps, from where the
  balls are, the same way every time.
- **A hall has nothing to remember.** A crossing is decided from where a ball is and
  which way it is going. It changes one number of the ball's position and nothing of
  its speed: the test compares them bit for bit.
- **A stroke is one input, with a shadow or without.** Which way the shadow goes is the
  hole's `mirror`, not the replay's business. The shadow's direction is the player's
  with one sign turned, not one worked out again.
- **The shadow is the second ball of the set, always.** The player's is the first, and
  the first is what a replay strikes and what a round is judged on.
- **An echo is read, never simulated.** Its place on a tick is the place the ball had
  that many ticks into the stroke before, the very numbers. An echo zone keeps only the
  ticks the ball spent inside it.
- **List a hole's echo zones before its echo plates.** A plate looks at where each echo
  is on the step being taken; listed first, it would look a tick late.
- **Local clipping is on in the renderer,** for the picture of a hall's far side, which
  is cut off at the edge of its skirt. Nothing else uses it.

- **Monsters act between strokes, and nowhere else.** The round calls the works once
  when every ball has stopped; a monster that moves then holds the stroke open, and a
  catch is an out-of-bounds counted apart (`caught`). While a ball rolls, every
  monster is a wall standing still.
- **A chase is decided on whole cells, a boss's turn on positions.** The step rule is
  `chaseStep`, with integer differences for a monster and half-cell ones for a boss;
  which way a boss faces is read from where the ball lies, which may be off the grid.
- **A door's lookahead is three ticks, a gate's is its signal's line.** A ball at full
  speed covers half a metre in three ticks: look further and a door opens for a ball
  that will bounce off something first.
- **The weak spot is a collider on the boss's body, told apart by its handle.** The
  strike is judged by the change in the ball's speed, as a stone's shove is, so a
  glancing touch does nothing.

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
