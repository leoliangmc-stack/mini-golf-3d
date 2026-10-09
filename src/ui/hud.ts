import type { Game } from '../app/game';
import { FIXED_DT } from '../core/loop';
import { goalCups } from '../game/goal';
import type { Outcome } from '../game/session';
import { byId } from './dom';
import { isWind } from '../physics/zones/wind';
import { onLangChange, TEXT, tr } from './i18n';

/** Delay before the result panel, so the ball is seen dropping into the cup first. */
const RESULT_DELAY_MS = 700;

export interface HudActions {
  onPause(): void;
  /** The player tapped retry (as opposed to the game resetting for another reason). */
  onRetry(): void;
  /** Leave the result panel for whatever comes next. */
  onNext(): void;
  /** Label for the result panel's main button, depending on what comes next. */
  nextLabel(): string;
  /** Heading above the result, e.g. "World complete!". */
  resultHeading(): string;
  /** The countdown kept running out and the player picked how to go on. */
  onStuckChoice(choice: 'retry' | 'concede'): void;
  /** The player asked to take the last stroke back. */
  onUndo(): void;
}

/** Binds the in-game overlay to the game: HUD, rule card, tutorial hint and result panel. */
export function createHud(game: Game, actions: HudActions): void {
  const holeName = byId('hole-name');
  const strokes = byId('strokes');
  const power = byId('power');
  const powerFill = byId('power-fill');
  const toast = byId('toast');
  const hint = byId('hint');
  const card = byId('card');
  const result = byId('result');
  const resultNext = byId<HTMLButtonElement>('result-next');
  const timer = byId('timer');
  const stuck = byId('stuck');
  const freeze = byId<HTMLButtonElement>('skill-freeze');
  const freezeCount = byId('skill-freeze-count');
  const picker = byId('ball-picker');
  const pins = byId('pins');
  const undo = byId<HTMLButtonElement>('undo');
  const gold = byId('gold');
  const turns = byId('turns');
  const alert = byId('alert');
  const wind = byId('wind');
  const windArrow = byId('wind-arrow');
  const windLeft = byId('wind-left');
  const windLabel = byId('wind-label');
  const beat = byId('beat');

  let toastTimer = 0;
  let resultTimer = 0;
  let aiming = false;
  let cardOpen = false;
  let lastOutcome: Outcome | null = null;
  /** The slingshot hint is shown until the player's first stroke, then never again. */
  let slingshotLearned = false;

  const showToast = (text: string) => {
    window.clearTimeout(toastTimer);
    toast.textContent = text;
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1600);
  };

  const setStuck = (open: boolean) => {
    stuck.hidden = !open;
    game.inputBlocked = open || cardOpen;
  };

  const hideTransient = () => {
    window.clearTimeout(toastTimer);
    window.clearTimeout(resultTimer);
    toast.classList.remove('show');
    result.hidden = true;
    lastOutcome = null;
    setStuck(false);
  };

  /** The countdown: tenths of a second, loud once it is nearly out. Touches the page only when it changes. */
  let timerShown: string | null = null;
  const drawTimer = () => {
    const ticks = game.session.timeLeft;
    const seconds = ticks === null ? 0 : ticks * FIXED_DT;
    const low = ticks !== null && seconds <= 3 && game.session.playing && game.session.strokes > 0;
    const shown = ticks === null ? null : `${seconds.toFixed(1)}${low ? '!' : ''}`;
    if (shown === timerShown) return;
    timerShown = shown;
    timer.hidden = ticks === null;
    timer.textContent = seconds.toFixed(1);
    timer.classList.toggle('low', low);
  };

  /**
   * What Chapters 3 and 4 add to the screen: the freeze button with its uses left, the
   * ball picker after a split, the pins still standing; the undo button, the gold picked
   * up and the dragon's meter. Touches the page only on a change.
   */
  let extrasShown = '';
  const drawExtras = () => {
    const { session } = game;
    const skill = session.skills.get('freeze');
    const pinTotal = session.goal.pins.length;
    // Chapter 4: the stroke that can be taken back, the gold, the dragon.
    const field = session.field;
    const coins = field?.all('coin') ?? [];
    const coinsHeld = coins.filter((coin) => coin.on).length;
    const dragon = field?.all('dragon')[0] as { def: { threshold: number }; on: boolean } | undefined;
    const state = [
      skill ? skill.charges : -1,
      session.frozen,
      session.canUseSkill('freeze'),
      game.choosing,
      pinTotal > 0 ? session.goal.pinsLeft : -1,
      session.rewindable ? session.canUndo : -1,
      coins.length > 0 ? coinsHeld : -1,
      dragon ? field!.alert : -1,
      field && field.turnsAllowed > 0 ? field.turnsLeft : -1,
    ].join();
    if (state === extrasShown) return;
    extrasShown = state;
    freeze.hidden = !skill;
    if (skill) {
      freezeCount.textContent = String(skill.charges);
      freeze.classList.toggle('frozen', session.frozen);
      freeze.classList.toggle('unready', !session.frozen && !session.canUseSkill('freeze'));
      freeze.setAttribute('aria-label', session.frozen ? TEXT.unfreeze() : TEXT.freeze());
    }
    if (session.frozen) document.body.dataset.frozen = '';
    else delete document.body.dataset.frozen;
    picker.hidden = !game.choosing;
    pins.hidden = pinTotal === 0;
    if (pinTotal > 0) pins.textContent = TEXT.pins(session.goal.pinsLeft, pinTotal);
    // Only where there is something to take back: works that keep time have nothing (SPEC v6 3.1).
    undo.hidden = !session.rewindable;
    undo.classList.toggle('unready', !session.canUndo);
    undo.setAttribute('aria-label', TEXT.undo());
    // Chapter 7: the turns of a wall group still to spend.
    const turnsAllowed = field?.turnsAllowed ?? 0;
    turns.hidden = turnsAllowed === 0;
    if (field && turnsAllowed > 0) {
      turns.textContent = TEXT.turns(field.turnsLeft, turnsAllowed);
      turns.classList.toggle('spent', field.turnsLeft === 0);
    }
    gold.hidden = coins.length === 0;
    if (coins.length > 0) {
      gold.textContent = TEXT.gold(coinsHeld, coins.length);
      gold.classList.toggle('all', coinsHeld === coins.length);
    }
    alert.hidden = !dragon;
    if (dragon && field) {
      alert.textContent = TEXT.alert(field.alert, dragon.def.threshold, dragon.on ? TEXT.dragonAwake() : TEXT.dragonAsleep());
      alert.classList.toggle('awake', dragon.on);
      alert.classList.toggle('stirring', !dragon.on && field.alert > 0);
    }
  };

  /**
   * The wind (SPEC v5 3.3): an arrow that points the way it blows as seen on screen,
   * whichever way the player has turned the view, and a bar that runs down to the next
   * change. Touches the page only when what it shows has changed.
   */
  let windShown = '';
  const drawWind = () => {
    const zone = game.session.zones.find(isWind);
    if (!zone) {
      // By what is on the page, not by what was last drawn: a new hole forgets the latter.
      if (!wind.hidden) wind.hidden = true;
      windShown = '';
      return;
    }
    const { x, z, left, turning } = zone.gust;
    const calm = x === 0 && z === 0;
    const onScreen = game.camera.groundToScreen(x, z);
    const degrees = calm ? 0 : Math.round((Math.atan2(onScreen.right, onScreen.up) * 180) / Math.PI);
    const shown = `${calm}|${degrees}|${Math.round(left * 46)}|${turning}`;
    if (shown === windShown) return;
    windShown = shown;
    wind.hidden = false;
    wind.classList.toggle('calm', calm);
    wind.classList.toggle('turning', turning);
    windLabel.textContent = calm ? TEXT.windCalm() : TEXT.wind();
    windArrow.style.transform = `rotate(${degrees}deg)`;
    windLeft.style.transform = `scaleX(${left.toFixed(3)})`;
  };

  /**
   * The metronome (SPEC v6 3.4): one dot for each beat of the bar, the dot of the beat
   * the hole is in lit, the first of the bar bigger than the rest. It reads the game's
   * clock and nothing else, so what it shows is what the machines do.
   */
  let beatShown = '';
  const drawBeat = () => {
    const def = game.hole.beat;
    if (!def) {
      if (!beat.hidden) beat.hidden = true;
      beatShown = '';
      return;
    }
    const bar = def.bar ?? 4;
    const tick = game.session.world.tick;
    const now = Math.floor(tick / def.ticks) % bar;
    // Each beat is lit at its start and fades over its length, in a few steps.
    const fade = 3 - Math.min(3, Math.floor(((tick % def.ticks) / def.ticks) * 4));
    const shown = `${bar}|${now}|${fade}`;
    if (shown === beatShown) return;
    if (beat.childElementCount !== bar) beat.replaceChildren(...Array.from({ length: bar }, () => document.createElement('i')));
    beatShown = shown;
    beat.hidden = false;
    Array.from(beat.children).forEach((dot, i) => {
      dot.className = i === now ? `on fade${fade}` : '';
    });
  };

  const fillResult = (outcome: Outcome) => {
    const { challenge, par, goal } = game.hole;
    // A hole with no cup is not "holed": its pins are cleared.
    const done = goalCups(goal).length === 0 ? TEXT.clearedIn(outcome.strokes) : TEXT.holedIn(outcome.strokes);
    byId('result-sub').textContent = actions.resultHeading();
    byId('result-title').textContent = outcome.holed ? done : TEXT.strokeLimit();
    byId('result-par').textContent = `${TEXT.result(outcome.strokes, par)}  ·  ${TEXT.time(outcome.ticks * FIXED_DT)}`;
    byId('result-stars')
      .querySelectorAll('span')
      .forEach((star, i) => star.classList.toggle('on', i < outcome.stars));
    const challengeLine = byId('result-challenge');
    challengeLine.textContent = challenge ? TEXT.challengeResult(tr(challenge.text), outcome.challengeMet) : '';
    challengeLine.classList.toggle('met', outcome.challengeMet);
    resultNext.textContent = actions.nextLabel();
  };

  const showResult = (outcome: Outcome) => {
    lastOutcome = outcome;
    fillResult(outcome);
    result.hidden = false;
  };

  const setCard = (open: boolean) => {
    if (open) {
      byId('card-world').textContent = tr(game.world.name);
      byId('card-rule').textContent = tr(game.world.ruleCard);
    }
    card.hidden = !open;
    cardOpen = open;
    game.inputBlocked = open || !stuck.hidden;
  };

  /** Everything whose text depends on the language or on the hole. */
  const relabel = () => {
    byId('retry').setAttribute('aria-label', TEXT.retry());
    byId('pause').setAttribute('aria-label', TEXT.pause());
    byId('cam-left').setAttribute('aria-label', TEXT.cameraLeft());
    byId('cam-right').setAttribute('aria-label', TEXT.cameraRight());
    byId('cam-in').setAttribute('aria-label', TEXT.zoomIn());
    byId('cam-out').setAttribute('aria-label', TEXT.zoomOut());
    byId('result-retry').textContent = TEXT.retry();
    byId('card-tap').textContent = TEXT.tapToStart();
    byId('hint-label').textContent = TEXT.hintSlingshot();
    byId('rotate-text').textContent = TEXT.rotate();
    byId('stuck-title').textContent = TEXT.stuckTitle();
    byId('stuck-body').textContent = TEXT.stuckBody();
    byId('stuck-retry').textContent = TEXT.tryAgain();
    byId('stuck-limit').textContent = TEXT.takeLimit();
    byId('ball-pick-label').textContent = TEXT.pickBall();
    byId('ball-prev').setAttribute('aria-label', TEXT.previousBall());
    byId('ball-next').setAttribute('aria-label', TEXT.nextBall());
    extrasShown = '';
    windShown = '';
    beatShown = '';
    holeName.textContent = TEXT.holeTitle(tr(game.world.name), game.holeNumber);
    byId('rule-tag').textContent = tr(game.world.ruleTag);
    byId('challenge').textContent = game.hole.challenge ? TEXT.challenge(tr(game.hole.challenge.text)) : '';
    if (cardOpen) setCard(true);
    if (lastOutcome) fillResult(lastOutcome);
    refresh();
  };

  const refresh = () => {
    strokes.textContent = TEXT.strokes(game.session.strokes, game.hole.par);
    const wantsHint =
      !slingshotLearned && (game.hole.hints?.includes('slingshot') ?? false) && game.session.phase === 'aiming';
    hint.classList.toggle('show', wantsHint && !aiming && !cardOpen);
  };

  game.on((event) => {
    switch (event.type) {
      case 'hole':
        hideTransient();
        // The rule card introduces a world, so it shows on that world's first hole only.
        setCard(event.intro && game.holeIndex === 0);
        relabel();
        return;
      case 'aim':
        aiming = event.power !== null;
        power.classList.toggle('active', aiming);
        if (event.power !== null) powerFill.style.height = `${Math.round(event.power * 100)}%`;
        break;
      case 'shot':
        slingshotLearned = true;
        break;
      case 'outOfBounds':
        showToast(TEXT.outOfBounds());
        break;
      case 'timeAdded':
        showToast(TEXT.timeBonus(event.seconds));
        break;
      case 'exploded':
        showToast(TEXT.timeUp());
        break;
      case 'frozen':
        showToast(TEXT.frozenHint());
        break;
      case 'cupAppeared':
        showToast(TEXT.cupAppeared());
        break;
      case 'undo':
        showToast(TEXT.undone());
        break;
      case 'turnRefused':
        showToast(event.reason === 'spent' ? TEXT.noTurnsLeft() : TEXT.ballInTheWay());
        break;
      case 'cue':
        if (event.name === 'dragonWake') showToast(TEXT.dragonWakes());
        else if (event.name === 'dragonStir') showToast(TEXT.dragonStirs());
        break;
      case 'pinDown':
        // On a hole that is all pins the result panel says it; here there is more to do.
        if (event.left === 0 && goalCups(game.hole.goal).length > 0) showToast(TEXT.allDown());
        break;
      case 'stuck':
        setStuck(true);
        break;
      case 'finished':
        resultTimer = window.setTimeout(showResult, RESULT_DELAY_MS, event.outcome);
        break;
      case 'reset':
        hideTransient();
        break;
    }
    refresh();
  });

  game.onFrame(() => {
    drawTimer();
    drawExtras();
    drawWind();
    drawBeat();
    if (!hint.classList.contains('show')) return;
    const p = game.ballScreenPosition();
    hint.style.transform = `translate(${p.x}px, ${p.y}px)`;
  });

  onLangChange(relabel);

  card.addEventListener('pointerdown', () => {
    setCard(false);
    refresh();
  });
  byId('stuck-retry').addEventListener('click', () => {
    setStuck(false);
    actions.onStuckChoice('retry');
  });
  byId('stuck-limit').addEventListener('click', () => {
    setStuck(false);
    actions.onStuckChoice('concede');
  });
  // On press, not on release: the moment matters while the ball is in the air.
  const toggleFreeze = () => {
    if (game.inputBlocked) return;
    if (game.session.frozen) game.resume();
    else game.useSkill('freeze');
  };
  freeze.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    toggleFreeze();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || !game.session.skills.has('freeze')) return;
    event.preventDefault();
    toggleFreeze();
  });
  undo.addEventListener('click', () => actions.onUndo());
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyZ' || event.repeat || !game.session.rewindable) return;
    event.preventDefault();
    actions.onUndo();
  });
  byId('ball-prev').addEventListener('click', () => game.pickNext(-1));
  byId('ball-next').addEventListener('click', () => game.pickNext(1));
  byId('pause').addEventListener('click', () => actions.onPause());
  byId('retry').addEventListener('click', () => actions.onRetry());
  byId('result-retry').addEventListener('click', () => actions.onRetry());
  resultNext.addEventListener('click', () => actions.onNext());
  byId('cam-left').addEventListener('click', () => game.camera.rotateBy(-45));
  byId('cam-right').addEventListener('click', () => game.camera.rotateBy(45));
  byId('cam-in').addEventListener('click', () => game.camera.zoomBy(0.8));
  byId('cam-out').addEventListener('click', () => game.camera.zoomBy(1.25));
}
