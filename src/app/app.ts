import { AudioEngine } from '../audio/audio';
import { startLoop } from '../core/loop';
import { registerContent } from '../data';
import { WORLDS } from '../data/worlds';
import { TEST_WORLD } from '../data/worlds/test';
import type { WorldDef } from '../level/schema';
import { initPhysics } from '../physics/rapier';
import { QualityController } from '../render/quality';
import { createStage } from '../render/scene';
import { renderThumbnail } from '../render/thumbnail';
import { registerBuiltinZoneViews } from '../render/zoneViews';
import { createHud } from '../ui/hud';
import { setLang, TEXT } from '../ui/i18n';
import { createScreens } from '../ui/screens';
import { track } from './analytics';
import { Game } from './game';
import { Progress, safeStorage, type HoleRef } from './progress';

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

  const dev = import.meta.env.DEV;
  const query = new URLSearchParams(location.search);
  // The test range is a development sandbox, not part of the game.
  const worlds = dev ? [...WORLDS, TEST_WORLD] : WORLDS;

  const progress = new Progress(WORLDS, safeStorage());
  // Development switch (SPEC 2.7): ?unlock opens every hole.
  progress.unlockAll = dev && query.has('unlock');
  if (progress.settings.lang && !query.has('lang')) setLang(progress.settings.lang);

  const stage = createStage(canvas);
  const quality = new QualityController(progress.settings.quality, (tier) => stage.applyQuality(tier));
  const game = new Game(stage, canvas, worlds);
  const audio = new AudioEngine();
  const thumbnails = new Map<WorldDef, string | null>();

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

  const screens = createScreens(WORLDS, progress, {
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
    thumbnail(world) {
      if (!thumbnails.has(world)) thumbnails.set(world, renderThumbnail(stage.renderer, world));
      return thumbnails.get(world) ?? null;
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
      return next.world === game.world ? TEXT.nextHole() : TEXT.nextWorld();
    },
    resultHeading() {
      if (!upNext()) return TEXT.allComplete();
      return game.isLastHole ? TEXT.worldComplete() : '';
    },
  });

  game.on((event) => {
    const hole = game.hole;
    switch (event.type) {
      case 'hole':
        audio.playMusic(game.world.theme);
        if (event.intro) {
          progress.setLast(hole.id);
          track('hole_start', { hole: hole.id });
        }
        break;
      case 'shot':
        audio.hit(event.power);
        break;
      case 'bounce':
        audio.bounce(event.kind, event.speed);
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
        if (event.name === 'launcherLoad') audio.cannonLoad();
        else if (event.name === 'launcherFire') audio.cannonFire();
        else if (event.name === 'gravityOn') audio.gravityShift(true);
        else if (event.name === 'gravityOff') audio.gravityShift(false);
        break;
      case 'finished': {
        const { outcome } = event;
        // The dev sandbox is not part of the game: nothing to save or report.
        if (!WORLDS.includes(game.world)) break;
        progress.complete(hole.id, outcome);
        track('hole_complete', { hole: hole.id, strokes: outcome.strokes, stars: outcome.stars, holed: outcome.holed });
        if (outcome.holed) audio.stars(outcome.stars);
        else {
          audio.strokeLimit();
          track('stroke_limit', { hole: hole.id });
        }
        if (game.isLastHole) {
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
  });

  applySettings();
  // Something to look at behind the menus.
  const resume = progress.resume();
  game.paused = true;
  setMode('menu');
  game.loadHole(resume.world, resume.index, false);

  startLoop(
    () => game.step(),
    (alpha, frameDt) => {
      game.render(alpha, frameDt);
      if (!game.paused) quality.frame(frameDt);
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
      // Development shortcut: ?hole=ice-2 starts on that hole.
      const requested = dev ? findHole(worlds, query.get('hole')) : null;
      if (requested) play(requested);
      else openMenu();
    },
  };
}
