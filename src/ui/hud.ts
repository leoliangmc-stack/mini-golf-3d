import type { Game } from '../app/game';
import { FIXED_DT } from '../core/loop';
import type { Outcome } from '../game/session';
import { byId } from './dom';
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

  const fillResult = (outcome: Outcome) => {
    const { challenge, par } = game.hole;
    byId('result-sub').textContent = actions.resultHeading();
    byId('result-title').textContent = outcome.holed ? TEXT.holedIn(outcome.strokes) : TEXT.strokeLimit();
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
  byId('pause').addEventListener('click', () => actions.onPause());
  byId('retry').addEventListener('click', () => actions.onRetry());
  byId('result-retry').addEventListener('click', () => actions.onRetry());
  resultNext.addEventListener('click', () => actions.onNext());
  byId('cam-left').addEventListener('click', () => game.camera.rotateBy(-45));
  byId('cam-right').addEventListener('click', () => game.camera.rotateBy(45));
  byId('cam-in').addEventListener('click', () => game.camera.zoomBy(0.8));
  byId('cam-out').addEventListener('click', () => game.camera.zoomBy(1.25));
}
