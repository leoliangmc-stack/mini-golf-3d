import type { I18nText } from '../core/types';

export type Lang = keyof I18nText;

function detectLang(): Lang {
  const forced = new URLSearchParams(location.search).get('lang');
  if (forced === 'en' || forced === 'zh') return forced;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let lang: Lang = detectLang();
const listeners = new Set<() => void>();

export const getLang = (): Lang => lang;

/** Switches language and tells every piece of UI on screen to redraw its text. */
export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  document.documentElement.lang = next === 'zh' ? 'zh-Hans' : 'en';
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
  finish: pick('FINISH', '完成'),
  rotate: pick('Rotate your device to landscape', '请将设备横过来'),
  outOfBounds: pick('OUT OF BOUNDS  +1', '出界  +1'),
  worldComplete: pick('WORLD COMPLETE!', '世界完成！'),
  allComplete: pick('ALL 18 HOLES COMPLETE!', '18 洞全部完成！'),
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
