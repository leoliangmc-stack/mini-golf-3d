import { AudioEngine } from '../audio/audio';
import { startLoop } from '../core/loop';
import { registerContent } from '../data';
import { CHAPTERS } from '../data/chapters';
import { TEST_WORLD } from '../data/worlds/test';
import type { Plate } from '../game/field/tomb';
import { allHoles, chapterOf, stagesOf } from '../level/chapters';
import type { WorldDef } from '../level/schema';
import { initPhysics } from '../physics/rapier';
import { registerBuiltinDecor } from '../render/decor';
import { registerBuiltinPartViews } from '../render/fieldViews';
import { isHandheld, QualityController } from '../render/quality';
import { createStage } from '../render/scene';
import { renderThumbnail } from '../render/thumbnail';
import { registerBuiltinZoneViews } from '../render/zoneViews';
import { createHud } from '../ui/hud';
import { setLang, TEXT, tr } from '../ui/i18n';
import { isPortrait, onOrientationChange } from '../ui/orientation';
import { createScreens } from '../ui/screens';
import { track } from './analytics';
import { Game } from './game';
import { Progress, safeStorage, type HoleRef } from './progress';
import { SAVE_VERSION } from './save';

/** A ball that lands this hard has dropped from somewhere, in m/s of velocity change. */
const HARD_LANDING = 4;
/** Seconds between frames while the game is paused: the course behind a menu stands still. */
const PAUSED_FRAME_SECONDS = 0.25;

/** The sound each cue makes. The two cues that depend on more than their name are handled where they arrive. */
const CUE_SOUNDS: Record<string, (audio: AudioEngine) => void> = {
  launcherLoad: (a) => a.cannonLoad(),
  launcherFire: (a) => a.cannonFire(),
  gravityOn: (a) => a.gravityShift(true),
  gravityOff: (a) => a.gravityShift(false),
  tunnelEnter: (a) => a.tunnelEnter(),
  tunnelExit: (a) => a.tunnelExit(),
  cupOpen: (a) => a.cupLid(true),
  cupShut: (a) => a.cupLid(false),
  timerTick: (a) => a.timerTick(),
  timerWarn: (a) => a.timerWarn(),
  grow: (a) => a.grow(),
  shrink: (a) => a.shrink(),
  split: (a) => a.split(),
  freeze: (a) => a.freeze(),
  resume: (a) => a.resume(),
  strike: (a) => a.strike(),
  cupAppear: (a) => a.cupAppear(),
  plateUp: (a) => a.plate(false),
  gateOpen: (a) => a.gate(true),
  gateShut: (a) => a.gate(false),
  stoneSlide: (a) => a.stoneSlide(),
  stoneBlocked: (a) => a.stoneBlocked(),
  stoneLand: (a) => a.stoneLand(),
  crystalTurn: (a) => a.crystalTurn(),
  beamLock: (a) => a.beamLock(),
  sliderStart: (a) => a.sliderStart(),
  sliderStop: (a) => a.sliderStop(),
  coin: (a) => a.coin(),
  bell: (a) => a.bell(),
  dragonStir: (a) => a.dragonStir(),
  fireOn: (a) => a.fire(),
  currentEnter: (a) => a.current(),
  bubbleCatch: (a) => a.bubbleCatch(),
  bubbleRelease: (a) => a.bubbleRelease(),
  gust: (a) => a.gust(),
  valveOpen: (a) => a.valve(true),
  valveShut: (a) => a.valve(false),
  waterRise: (a) => a.waterMove(true),
  waterFall: (a) => a.waterMove(false),
  waterSettle: (a) => a.waterSettle(),
  splash: (a) => a.splash(),
  slabCrack: (a) => a.slabCrack(),
  slabFall: (a) => a.slabFall(),
  leverOn: (a) => a.lever(true),
  leverOff: (a) => a.lever(false),
  beltTurn: (a) => a.beltTurn(),
  beltRun: (a) => a.beltRun(),
  armCatch: (a) => a.armCatch(),
  armLift: (a) => a.armLift(),
  armRelease: (a) => a.armRelease(),
  shutterOpen: (a) => a.shutter(true),
  shutterShut: (a) => a.shutter(false),
  drumBeat: (a) => a.drumBeat(),
  drumThrow: (a) => a.drumThrow(),
  dialTurn: (a) => a.dialTurn(),
  timeSlow: (a) => a.timeShift(true),
  timeFast: (a) => a.timeShift(false),
  tunnelTurn: (a) => a.tunnelTurn(),
  pointsSwitch: (a) => a.points(),
  trainBoard: (a) => a.trainBoard(),
  trainDepart: (a) => a.trainDepart(),
  trainArrive: (a) => a.trainArrive(),
  trainSetDown: (a) => a.trainSetDown(),
  coasterEnter: (a) => a.coasterEnter(),
  coasterLoop: (a) => a.coasterLoop(),
  coasterStall: (a) => a.coasterStall(),
  coasterExit: (a) => a.coasterOut(true),
  coasterBack: (a) => a.coasterOut(false),
  coasterHigh: (a) => a.coasterFork(true),
  coasterLow: (a) => a.coasterFork(false),
  rotorTurn: (a) => a.rotorTurn(),
  rotorStop: (a) => a.rotorStop(),
  wrap: (a) => a.wrap(),
  mirrorShot: (a) => a.mirrorShot(),
  shadowBack: (a) => a.shadowBack(),
  echoStart: (a) => a.echoStart(),
  echoPlateDown: (a) => a.echoPlate(true),
  echoPlateUp: (a) => a.echoPlate(false),
  realmGhost: (a) => a.realmSwap(true),
  realmReal: (a) => a.realmSwap(false),
  monsterStep: (a) => a.monsterStep(),
  bossStep: (a) => a.monsterStep(),
  caught: (a) => a.caught(),
  keyTake: (a) => a.keyTake(),
  doorOpen: (a) => a.doorOpen(),
  bossTurn: (a) => a.bossTurn(),
  bossHit: (a) => a.bossHit(),
  shieldHit: (a) => a.shieldHit(),
  shieldOpen: (a) => a.shieldOpen(),
  bossDown: (a) => a.bossDown(),
};

export interface App {
  /** Call from the first tap: unlocks audio and opens the main menu (or the requested hole). */
  start(): void;
}

function findHole(worlds: readonly WorldDef[], id: string | null): HoleRef | null {
  for (const world of worlds) {
    const index = world.holes.findIndex((hole) => hole.id === id);
    if (index >= 0) return { world, index };
  }
  return null;
}

/** Builds the whole game and wires its parts together. Nothing is audible or interactive until `start`. */
export async function createApp(canvas: HTMLCanvasElement): Promise<App> {
  await initPhysics();
  registerContent();
  registerBuiltinZoneViews();
  registerBuiltinPartViews();
  registerBuiltinDecor();

  const dev = import.meta.env.DEV;
  const query = new URLSearchParams(location.search);
  /** Every world and finale of the game, in play order. */
  const stages = CHAPTERS.flatMap(stagesOf);
  // The test range is a development sandbox, not part of the game.
  const worlds = dev ? [...stages, TEST_WORLD] : stages;

  const progress = new Progress(CHAPTERS, safeStorage());
  // Development switch (SPEC 2.7): ?unlock opens every hole.
  progress.unlockAll = dev && query.has('unlock');
  if (progress.settings.lang && !query.has('lang')) setLang(progress.settings.lang);

  const stage = createStage(canvas, { antialias: !isHandheld() });
  const quality = new QualityController(progress.settings.quality, (tier) => stage.applyQuality(tier));
  const game = new Game(stage, canvas, CHAPTERS, worlds);
  const audio = new AudioEngine();
  const thumbnails = new Map<WorldDef, string | null>();
  /** Worlds whose picture is wanted, made one per frame so that a page of cards never stalls. */
  const wanted: { world: WorldDef; later: (url: string) => void }[] = [];
  let makingThumbnails = false;
  const makeThumbnail = () => {
    makingThumbnails = false;
    const next = wanted.shift();
    if (!next) return;
    if (!thumbnails.has(next.world)) thumbnails.set(next.world, renderThumbnail(stage.renderer, next.world));
    const url = thumbnails.get(next.world);
    if (url) next.later(url);
    if (wanted.length === 0) return;
    makingThumbnails = true;
    requestAnimationFrame(makeThumbnail);
  };

  const applySettings = () => {
    audio.setSfx(progress.settings.sfx);
    audio.setMusic(progress.settings.music);
    quality.setSetting(progress.settings.quality);
  };

  const setMode = (mode: 'menu' | 'play') => {
    document.body.dataset.mode = mode;
  };

  const play = (ref: HoleRef) => {
    screens.hide();
    setMode('play');
    game.paused = false;
    game.loadHole(ref.world, ref.index);
  };

  const openMenu = () => {
    game.paused = true;
    setMode('menu');
    audio.playMusic('meadow');
    screens.show('menu');
  };

  /** What follows the current hole: the next one, or nothing after the very last. */
  const upNext = (): HoleRef | null => progress.next(game.world, game.holeIndex);

  /**
   * Reports, once, that this player's save was carried over from an older version
   * (SPEC v2 2.11): the count of returning players. Nothing about the player is sent.
   * Tried again later if no analytics provider was there to take it.
   */
  const reportMigration = () => {
    const from = progress.migratedFrom;
    if (from === null) return;
    const sent = track('save_migrated', { from, to: SAVE_VERSION, holes: progress.completedHoles });
    if (sent) progress.migrationReported();
  };

  const screens = createScreens(CHAPTERS, progress, {
    play,
    resume() {
      screens.hide();
      game.paused = false;
    },
    retry() {
      track('retry', { hole: game.hole.id });
      screens.hide();
      game.paused = false;
      game.retry();
    },
    quit: openMenu,
    settingsChanged: applySettings,
    click: () => audio.click(),
    thumbnail(world, later) {
      const made = thumbnails.get(world);
      if (made !== undefined) return made;
      wanted.push({ world, later });
      if (!makingThumbnails) {
        makingThumbnails = true;
        requestAnimationFrame(makeThumbnail);
      }
      return null;
    },
  });

  createHud(game, {
    onPause() {
      audio.click();
      game.paused = true;
      screens.show('pause');
    },
    onRetry() {
      audio.click();
      track('retry', { hole: game.hole.id });
      game.retry();
    },
    onNext() {
      audio.click();
      const next = upNext();
      if (next) play(next);
      else openMenu();
    },
    nextLabel() {
      const next = upNext();
      if (!next) return TEXT.finish();
      if (next.world === game.world) return TEXT.nextHole();
      const chapter = chapterOf(CHAPTERS, next.world);
      if (chapter?.finale === next.world) return TEXT.finalHole();
      return chapter === game.chapter ? TEXT.nextWorld() : TEXT.nextChapter();
    },
    resultHeading() {
      // The last hole in the list is not the end of the game for a player who went
      // straight from Chapter 2 to Chapter 4.
      if (!upNext() && progress.allComplete) return TEXT.allComplete(allHoles(CHAPTERS).length);
      // The last hole of the last chapter, with Chapter 3 perhaps still to play (SPEC v9 3.7).
      if (!upNext()) return TEXT.theEnd();
      if (game.isFinale && game.chapter) return TEXT.chapterComplete(tr(game.chapter.name));
      return game.isLastHole ? TEXT.worldComplete() : '';
    },
    onUndo() {
      if (!game.undo()) return;
      if (stages.includes(game.world)) track('undo', { hole: game.hole.id });
    },
    onStuckChoice(choice) {
      audio.click();
      if (choice === 'retry') {
        track('retry', { hole: game.hole.id });
        game.retry();
      } else {
        track('bomb_concede', { hole: game.hole.id });
        game.concede();
      }
    },
  });

  /** True if the shadow ball of a hole with a mirror is on one of the hole's plates. */
  const shadowOnPlate = (): boolean => {
    const shadow = game.session.shadow;
    if (!shadow) return false;
    const p = shadow.position();
    return (game.session.field?.all<Plate>('plate') ?? []).some(
      (plate) => Math.hypot(p.x - plate.anchor.x, p.z - plate.anchor.z) <= plate.radius + 0.35,
    );
  };

  game.on((event) => {
    const hole = game.hole;
    switch (event.type) {
      case 'hole':
        // On a hole that keeps a beat the music keeps it too (SPEC v6 3.4).
        audio.playMusic(game.world.theme, hole.beat?.ticks);
        if (event.intro) {
          progress.setLast(hole.id);
          track('hole_start', { hole: hole.id });
          reportMigration();
        }
        break;
      case 'shot':
        if (event.frozen) audio.airShot(event.power);
        else audio.hit(event.power);
        break;
      case 'pinDown':
        audio.pinDown();
        break;
      case 'bounce':
        if (event.kind === 'ground' && event.speed >= HARD_LANDING) audio.land(event.speed);
        else audio.bounce(event.kind, event.speed);
        break;
      case 'surface':
        audio.surface(event.id);
        break;
      case 'outOfBounds':
        audio.outOfBounds();
        break;
      case 'holed':
        audio.holed();
        break;
      case 'cue':
        if (event.name === 'plateDown') {
          // A plate the shadow is standing on sounds different (SPEC v8 3.9).
          if (shadowOnPlate()) audio.shadowPlate();
          else audio.plate(true);
        } else if (event.name === 'dragonWake') {
          audio.dragonWake();
          if (stages.includes(game.world)) track('dragon_woke', { hole: hole.id });
        } else {
          CUE_SOUNDS[event.name]?.(audio);
        }
        break;
      case 'undo':
        audio.undo();
        break;
      case 'note':
        audio.keyNote(event.degree);
        break;
      case 'lamp':
        audio.lamp();
        break;
      case 'turnRefused':
        audio.turnRefused();
        break;
      case 'trainPass':
        audio.trainPass();
        break;
      case 'phantom':
        audio.phantom(event.shown);
        break;
      case 'showcase':
        if (stages.includes(game.world)) track('showcase', { hole: hole.id, skipped: event.skipped });
        break;
      case 'timeAdded':
        audio.timeBonus();
        break;
      case 'exploded':
        audio.explode();
        if (stages.includes(game.world)) track('explode', { hole: hole.id });
        break;
      case 'finished': {
        const { outcome } = event;
        // The dev sandbox is not part of the game: nothing to save or report.
        if (!stages.includes(game.world)) break;
        progress.complete(hole.id, outcome);
        track('hole_complete', { hole: hole.id, strokes: outcome.strokes, stars: outcome.stars, holed: outcome.holed });
        if (outcome.holed) audio.stars(outcome.stars);
        else {
          audio.strokeLimit();
          track('stroke_limit', { hole: hole.id });
        }
        if (game.isFinale) {
          // The last hole of the game gets a fanfare of its own (SPEC v9 3.10).
          if (upNext() === null) audio.gameComplete();
          else audio.chapterComplete();
          track('chapter_complete', { chapter: game.chapter?.id ?? '', stars: progress.worldStars(game.world) });
        } else if (game.isLastHole) {
          audio.worldComplete();
          track('world_complete', { world: game.world.id, stars: progress.worldStars(game.world) });
        }
        break;
      }
    }
  });

  game.onFrame(() => {
    const { level, attracts } = game.magnetProximity();
    audio.setHum(game.paused ? 0 : level, attracts);
    // Music that keeps a hole's beat is told the game's clock, and never the other way round.
    if (!game.paused) audio.followBeat(game.session.world.tick, game.frameAlpha);
  });

  applySettings();
  // Something to look at behind the menus.
  const resume = progress.resume();
  game.paused = true;
  setMode('menu');
  game.loadHole(resume.world, resume.index, false);

  // Nothing moves, and no countdown runs, while the course cannot be seen: behind the
  // "rotate your device" notice, or in a tab the browser still ticks in the background.
  // And while the game is paused the course is drawn only a few times a second: what is
  // behind a menu stands still, and the blur over it is redone each time it is drawn.
  game.offScreen = isPortrait();
  onOrientationChange(() => {
    game.offScreen = isPortrait();
  });
  let idle = 0;
  startLoop(
    () => {
      if (!isPortrait() && !document.hidden) game.step();
    },
    (alpha, frameDt) => {
      if (game.paused) {
        idle += frameDt;
        if (idle < PAUSED_FRAME_SECONDS) return;
        game.render(alpha, idle);
        idle = 0;
        return;
      }
      idle = 0;
      game.render(alpha, frameDt);
      quality.frame(frameDt);
    },
  );

  if (dev) {
    const { mountDebugPanel } = await import('../debug/panel');
    mountDebugPanel(game, progress);
    // Console handle for poking at the game during development.
    Object.assign(window, { golf: game });
  }

  return {
    start() {
      audio.unlock();
      reportMigration();
      // Development shortcut: ?hole=ice-2 starts on that hole.
      const requested = dev ? findHole(worlds, query.get('hole')) : null;
      if (requested) play(requested);
      else openMenu();
    },
  };
}
