import type { I18nText } from '../core/types';

export type Lang = keyof I18nText;

function detectLang(): Lang {
  const forced = new URLSearchParams(location.search).get('lang');
  if (forced === 'en' || forced === 'zh') return forced;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/** Tells the browser (screen readers, CJK font selection) which language the page is in. */
function markDocument(current: Lang): void {
  document.documentElement.lang = current === 'zh' ? 'zh-Hans' : 'en';
}

let lang: Lang = detectLang();
markDocument(lang);
const listeners = new Set<() => void>();

export const getLang = (): Lang => lang;

/** Switches language and tells every piece of UI on screen to redraw its text. */
export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  markDocument(next);
  for (const listener of listeners) listener();
}

export function onLangChange(listener: () => void): void {
  listeners.add(listener);
}

/** Picks the current language from a piece of bilingual data. */
export const tr = (text: I18nText): string => text[lang];

const zh = (): boolean => lang === 'zh';
const pick = (en: string, cn: string) => (): string => (zh() ? cn : en);

/** Every piece of interface text. Nothing user-visible may be written anywhere else. */
export const TEXT = {
  title: pick('3D MINI GOLF', '3D 迷你高尔夫'),
  tagline: pick('Every world has a different rule.', '每个世界都有一条不同的规则。'),
  loading: pick('LOADING…', '加载中…'),
  tapToStart: pick('TAP TO START', '点击开始'),
  play: pick('PLAY', '开始游戏'),
  worlds: pick('WORLDS', '世界'),
  settings: pick('SETTINGS', '设置'),
  resume: pick('RESUME', '继续'),
  retry: pick('RETRY', '重打'),
  mainMenu: pick('MAIN MENU', '主菜单'),
  back: pick('BACK', '返回'),
  paused: pick('PAUSED', '已暂停'),
  nextHole: pick('NEXT HOLE', '下一洞'),
  nextWorld: pick('NEXT WORLD', '下一个世界'),
  nextChapter: pick('NEXT CHAPTER', '下一章'),
  finalHole: pick('FINAL HOLE', '终局洞'),
  finish: pick('FINISH', '完成'),
  rotate: pick('Rotate your device to landscape', '请将设备横过来'),
  outOfBounds: pick('OUT OF BOUNDS  +1', '出界  +1'),
  worldComplete: pick('WORLD COMPLETE!', '世界完成！'),
  finale: pick('FINALE', '终局'),
  timeUp: pick("BOOM! TIME'S UP", '轰！时间到'),
  stuckTitle: pick('OUT OF TIME AGAIN', '又没时间了'),
  stuckBody: pick(
    'Try once more, or take the stroke limit and move on with one star.',
    '可以再试一次，也可以以杆数上限完成本洞（记 1 星），继续前进。',
  ),
  tryAgain: pick('TRY AGAIN', '再试一次'),
  takeLimit: pick('TAKE THE LIMIT ★', '以上限完成 ★'),
  hintSlingshot: pick('DRAG BACK, THEN RELEASE', '按住往后拖，松手击球'),
  strokeLimit: pick('STROKE LIMIT', '达到杆数上限'),
  locked: pick('LOCKED', '未解锁'),
  language: pick('Language', '语言'),
  sound: pick('Sound effects', '音效'),
  music: pick('Music', '音乐'),
  quality: pick('Graphics', '画质'),
  on: pick('ON', '开'),
  off: pick('OFF', '关'),
  qualityAuto: pick('AUTO', '自动'),
  qualityLow: pick('LOW', '低'),
  qualityMedium: pick('MEDIUM', '中'),
  qualityHigh: pick('HIGH', '高'),
  credits: pick('Credits', '致谢'),
  creditsBody: pick(
    'Built with Three.js (MIT) and Rapier (Apache-2.0). All graphics are generated in code and all sound and music is synthesised in the browser: the game ships no third-party art or audio.',
    '基于 Three.js（MIT）与 Rapier（Apache-2.0）构建。所有画面由代码生成，所有音效与音乐在浏览器中实时合成：本游戏不含任何第三方美术或音频素材。',
  ),
  cameraLeft: pick('Rotate view left', '向左旋转视角'),
  cameraRight: pick('Rotate view right', '向右旋转视角'),
  zoomIn: pick('Zoom in', '放大'),
  zoomOut: pick('Zoom out', '缩小'),
  pause: pick('Pause', '暂停'),
  freeze: pick('Freeze time', '冻结时间'),
  unfreeze: pick('Let time run', '恢复时间'),
  frozenHint: pick('TIME IS FROZEN · DRAG TO SHOOT AGAIN', '时间已冻结 · 拖动可再打一杆'),
  pickBall: pick('TAP A BALL TO PICK IT', '点一下选择要打的球'),
  previousBall: pick('Previous ball', '上一个球'),
  nextBall: pick('Next ball', '下一个球'),
  cupAppeared: pick('THE HOLE APPEARS!', '洞口出现了！'),
  undo: pick('Take back the last stroke', '撤销上一杆'),
  undone: pick('STROKE TAKEN BACK  +1', '已撤销一杆  +1'),
  dragonStirs: pick('THE DRAGON STIRS…', '巨龙动了一下…'),
  dragonWakes: pick('THE DRAGON WAKES!', '巨龙醒了！'),
  dragonAsleep: pick('ASLEEP', '沉睡'),
  dragonAwake: pick('AWAKE', '已醒'),
  allDown: pick('ALL PINS DOWN!', '木桩全倒！'),
  allComplete: (holes: number) => (zh() ? `${holes} 洞全部完成！` : `ALL ${holes} HOLES COMPLETE!`),
  chapterComplete: (chapter: string) => (zh() ? `${chapter}完成！` : `${chapter.toUpperCase()} COMPLETE!`),
  chapterLocked: (previous: string) =>
    zh() ? `完成${previous}的终局洞后解锁` : `Finish the ${previous} finale to unlock`,
  timeBonus: (seconds: number) => (zh() ? `+${seconds} 秒` : `+${seconds} s`),
  pins: (left: number, total: number) => (zh() ? `木桩 ${left} / ${total}` : `PINS ${left} / ${total}`),
  gold: (have: number, total: number) => (zh() ? `金币 ${have} / ${total}` : `GOLD ${have} / ${total}`),
  /** The dragon's meter: one mark for each noise it can still sleep through, and the ones it has heard. */
  alert: (heard: number, threshold: number, state: string) => {
    const marks = '●'.repeat(Math.min(heard, threshold)) + '○'.repeat(Math.max(0, threshold - heard));
    return zh() ? `巨龙 ${marks} ${state}` : `DRAGON ${marks} ${state}`;
  },
  /** Result of a hole that is all pins. */
  clearedIn: (strokes: number) => {
    if (strokes === 1) return zh() ? '一杆全倒！' : 'STRIKE!';
    return zh() ? `${strokes} 杆全倒` : `CLEARED IN ${strokes}`;
  },
  holeTitle: (world: string, hole: number) =>
    zh() ? `${world} · 第 ${hole} 洞` : `${world.toUpperCase()} · HOLE ${hole}`,
  hole: (hole: number) => (zh() ? `第 ${hole} 洞` : `HOLE ${hole}`),
  strokes: (strokes: number, par: number) =>
    zh() ? `杆数 ${strokes} · 标准杆 ${par}` : `STROKES ${strokes} · PAR ${par}`,
  par: (par: number) => (zh() ? `标准杆 ${par}` : `PAR ${par}`),
  best: (strokes: number) => (zh() ? `最佳 ${strokes} 杆` : `BEST ${strokes}`),
  starCount: (have: number, of: number) => `★ ${have} / ${of}`,
  holedIn: (strokes: number) => {
    if (strokes === 1) return zh() ? '一杆进洞！' : 'HOLE IN ONE!';
    return zh() ? `${strokes} 杆进洞` : `HOLED IN ${strokes}`;
  },
  result: (strokes: number, par: number) =>
    zh() ? `${strokes} 杆 · 标准杆 ${par}` : `${strokes} ${strokes === 1 ? 'STROKE' : 'STROKES'} · PAR ${par}`,
  time: (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = String(Math.floor(seconds % 60)).padStart(2, '0');
    return zh() ? `用时 ${m}:${s}` : `TIME ${m}:${s}`;
  },
  challenge: (text: string) => `★★★  ${text}`,
  challengeResult: (text: string, met: boolean) => `${met ? '✓' : '✗'}  ${text}`,
};
