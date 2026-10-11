import type { HoleRef, Progress, Quality } from '../app/progress';
import { chapterOf, holeNumber, stagesOf } from '../level/chapters';
import type { ChapterDef, WorldDef } from '../level/schema';
import { byId, el } from './dom';
import { getLang, onLangChange, setLang, TEXT, tr, type Lang } from './i18n';
import { cardArt, pageArt } from './worldArt';

export type ScreenId = 'menu' | 'worlds' | 'world' | 'settings' | 'pause';

export interface ScreenActions {
  /** Start playing a hole. */
  play(ref: HoleRef): void;
  resume(): void;
  retry(): void;
  /** Leave the hole for the main menu. */
  quit(): void;
  /** A setting changed and has been saved; apply it. */
  settingsChanged(): void;
  /** Any button was pressed. */
  click(): void;
}

export interface Screens {
  /** Shows a screen. `back` is where its back button leads. */
  show(id: ScreenId, world?: WorldDef): void;
  hide(): void;
  readonly current: ScreenId | null;
}

const starString = (stars: number, of = 3): string => '★'.repeat(stars) + '☆'.repeat(of - stars);

/** Menus: everything the player sees that is not the hole itself. Drawn into #screen. */
export function createScreens(chapters: readonly ChapterDef[], progress: Progress, actions: ScreenActions): Screens {
  const root = byId('screen');
  const worlds = chapters.flatMap(stagesOf);
  let current: ScreenId | null = null;
  let currentWorld: WorldDef | undefined;
  /** The chapter whose tab is open on the worlds screen. */
  let currentChapter = chapters[0];
  /** Where "back" from Settings and Worlds returns to: the main menu, or the pause menu mid-hole. */
  let home: 'menu' | 'pause' = 'menu';

  const button = (label: string, onClick: () => void, className = ''): HTMLButtonElement => {
    const node = el('button', { type: 'button', className, textContent: label });
    node.addEventListener('click', () => {
      actions.click();
      onClick();
    });
    return node;
  };

  /** `aside` is what sits across from the back button: a star count, the language switch. */
  const header = (title: string, back: () => void, ...aside: Node[]) =>
    el(
      'header',
      { className: 'screen-header' },
      button(`‹ ${TEXT.back()}`, back, 'ghost'),
      el('h2', { textContent: title }),
      el('div', { className: 'header-aside' }, ...aside),
    );

  /** Mutually exclusive choices, side by side. */
  const segments = <T>(options: [T, string][], value: T, onPick: (value: T) => void) =>
    el('div', { className: 'segments' }, ...options.map(([option, text]) => button(text, () => onPick(option), option === value ? 'on' : '')));

  /** The page redraws itself through onLangChange. */
  const pickLang = (lang: Lang) => {
    progress.setSetting('lang', lang);
    actions.settingsChanged();
    setLang(lang);
  };

  /**
   * A page that lies on a blurred picture of a world instead of on the hole behind:
   * the picture fills the screen and the page scrolls over it.
   */
  const onArt = (world: WorldDef, ...content: Node[]) => {
    const backdrop = el('div', { className: 'backdrop' });
    const art = cardArt(world);
    if (art) backdrop.style.backgroundImage = `url(${art})`;
    return [backdrop, el('div', { className: 'page' }, ...content)];
  };

  const picture = (url: string | undefined, className: string, ...over: Node[]) =>
    el('div', { className }, ...(url ? [el('img', { src: url, alt: '', decoding: 'async' })] : []), ...over);

  /** A world's large picture. Its card's picture, already loaded, stands in until it arrives. */
  const hero = (world: WorldDef, ...over: Node[]) => {
    const node = picture(pageArt(world), 'world-hero', ...over);
    const small = cardArt(world);
    if (small) node.style.backgroundImage = `url(${small})`;
    return node;
  };

  const totalStars = () => worlds.reduce((sum, world) => sum + progress.worldStars(world), 0);
  const maxStars = () => worlds.reduce((sum, world) => sum + world.holes.length * 3, 0);

  const menu = () => [
    el(
      'div',
      { className: 'stack' },
      el('h1', { className: 'logo', textContent: TEXT.title() }),
      el('p', { className: 'tagline', textContent: TEXT.tagline() }),
      button(TEXT.play(), () => actions.play(progress.resume()), 'primary big'),
      button(TEXT.worlds(), () => show('worlds'), 'big'),
      button(TEXT.settings(), () => show('settings'), 'big'),
      el('p', { className: 'total', textContent: TEXT.starCount(totalStars(), maxStars()) }),
    ),
  ];

  const pause = () => [
    el(
      'div',
      { className: 'stack' },
      el('h1', { className: 'logo small', textContent: TEXT.paused() }),
      button(TEXT.resume(), () => actions.resume(), 'primary big'),
      button(TEXT.retry(), () => actions.retry(), 'big'),
      button(TEXT.worlds(), () => show('worlds'), 'big'),
      button(TEXT.settings(), () => show('settings'), 'big'),
      button(TEXT.mainMenu(), () => actions.quit(), 'big'),
    ),
  ];

  /** `badge` is what the corner of the card shows: the world's number, or a flag for a finale. */
  const worldCard = (world: WorldDef, badge: string, finale: boolean) => {
    const open = progress.isUnlocked(world, 0);
    const card = button('', () => show('world', world), finale ? 'world-card finale' : 'world-card');
    card.disabled = !open;
    card.append(
      open
        ? picture(cardArt(world), 'world-picture')
        : picture(cardArt(world), 'world-picture locked', el('span', { textContent: '🔒' })),
      el('span', { className: 'world-number', textContent: badge }),
      el('strong', { textContent: finale ? `${TEXT.finale()} · ${tr(world.name)}` : tr(world.name) }),
      el('span', {
        className: 'world-stars',
        textContent: open ? TEXT.starCount(progress.worldStars(world), world.holes.length * 3) : TEXT.locked(),
      }),
    );
    return card;
  };

  /** One tab per chapter; the page under them shows that chapter's worlds, then its finale. */
  const worldList = () => {
    const chapter = currentChapter;
    const position = chapters.indexOf(chapter);
    // Worlds are numbered straight through the chapters: Chapter 2 starts at world 7.
    const worldsBefore = chapters.slice(0, position).reduce((sum, c) => sum + c.worlds.length, 0);
    const tabs = chapters.map((c) => {
      const label = progress.chapterUnlocked(c) ? tr(c.name) : `🔒 ${tr(c.name)}`;
      const tab = button(
        label,
        () => {
          currentChapter = c;
          draw();
        },
        c === chapter ? 'on' : '',
      );
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(c === chapter));
      return tab;
    });
    const locked =
      position > 0 && !progress.chapterUnlocked(chapter)
        ? [el('p', { className: 'chapter-locked', textContent: TEXT.chapterLocked(tr((progress.opener(chapter) ?? chapters[position - 1]).name)) })]
        : [];
    return onArt(
      chapter.worlds[0],
      header(
        TEXT.worlds(),
        () => show(home),
        el('span', { className: 'star-count', textContent: TEXT.starCount(totalStars(), maxStars()) }),
        segments<Lang>([['zh', '中'], ['en', 'EN']], getLang(), pickLang),
      ),
      el('div', { className: 'tabs', role: 'tablist' }, ...tabs),
      ...locked,
      el(
        'div',
        { className: 'world-grid' },
        ...chapter.worlds.map((world, i) => worldCard(world, String(worldsBefore + i + 1), false)),
        worldCard(chapter.finale, '⚑', true),
      ),
    );
  };

  const worldDetail = (world: WorldDef) => {
    const chapter = chapterOf(chapters, world);
    const finale = chapter?.finale === world;
    // A finale goes by its number in the chapter: hole 19, not hole 1.
    const number = (index: number) => (chapter && finale ? holeNumber(chapter, world, index) : index + 1);
    const holes = el(
      'div',
      { className: 'hole-list' },
      ...world.holes.map((hole, index) => {
        const record = progress.record(hole.id);
        const row = button('', () => actions.play({ world, index }), 'hole-row');
        row.disabled = !progress.isUnlocked(world, index);
        row.append(
          el('strong', { textContent: TEXT.hole(number(index)) }),
          el('span', { className: 'hole-par', textContent: TEXT.par(hole.par) }),
          el('span', { className: 'hole-stars', textContent: row.disabled ? '🔒' : starString(record?.stars ?? 0) }),
          el('span', { className: 'hole-best', textContent: record ? TEXT.best(record.strokes) : '' }),
        );
        return row;
      }),
    );
    return onArt(
      world,
      header(
        finale ? `${TEXT.finale()} · ${tr(world.name)}` : tr(world.name),
        () => show('worlds'),
        el('span', { className: 'star-count', textContent: TEXT.starCount(progress.worldStars(world), world.holes.length * 3) }),
      ),
      el(
        'div',
        { className: 'world-detail' },
        el(
          'div',
          { className: 'world-face' },
          hero(
            world,
            el(
              'div',
              { className: 'chips' },
              ...(chapter ? [el('span', { className: 'chapter', textContent: tr(chapter.name) })] : []),
              el('span', { textContent: tr(world.ruleTag) }),
            ),
          ),
          el('p', { className: 'rule', textContent: tr(world.ruleCard) }),
        ),
        holes,
      ),
    );
  };

  /** A setting: its name, and its choices. */
  const choice = <T>(label: string, options: [T, string][], value: T, onPick: (value: T) => void) =>
    el('div', { className: 'setting' }, el('span', { textContent: label }), segments(options, value, onPick));

  const settings = () => {
    const s = progress.settings;
    const change = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
      progress.setSetting(key, value);
      actions.settingsChanged();
      show('settings');
    };
    return [
      header(TEXT.settings(), () => show(home)),
      el(
        'div',
        { className: 'settings' },
        choice<Lang>(TEXT.language(), [['zh', '中文'], ['en', 'English']], getLang(), pickLang),
        choice(TEXT.sound(), [[true, TEXT.on()], [false, TEXT.off()]], s.sfx, (on) => change('sfx', on)),
        choice(TEXT.music(), [[true, TEXT.on()], [false, TEXT.off()]], s.music, (on) => change('music', on)),
        choice<Quality>(
          TEXT.quality(),
          [
            ['auto', TEXT.qualityAuto()],
            ['low', TEXT.qualityLow()],
            ['medium', TEXT.qualityMedium()],
            ['high', TEXT.qualityHigh()],
          ],
          s.quality,
          (quality) => change('quality', quality),
        ),
        el('h3', { textContent: TEXT.credits() }),
        el('p', { className: 'credits', textContent: TEXT.creditsBody() }),
      ),
    ];
  };

  const draw = () => {
    if (!current) return;
    const content =
      current === 'menu'
        ? menu()
        : current === 'pause'
          ? pause()
          : current === 'worlds'
            ? worldList()
            : current === 'world' && currentWorld
              ? worldDetail(currentWorld)
              : settings();
    root.dataset.screen = current;
    root.replaceChildren(...content);
    // The row of tabs scrolls sideways on a narrow screen: bring the open chapter's tab to
    // its middle. Not scrollIntoView, which would also shift the page under the tabs.
    const tabs = root.querySelector('.tabs');
    const open = tabs?.querySelector('.on');
    if (tabs && open) {
      const row = tabs.getBoundingClientRect();
      const tab = open.getBoundingClientRect();
      tabs.scrollLeft += tab.left + tab.width / 2 - (row.left + row.width / 2);
    }
  };

  function show(id: ScreenId, world?: WorldDef): void {
    // Coming in from a menu, the worlds screen opens on the chapter the player is in.
    if (id === 'worlds' && (current === 'menu' || current === 'pause')) {
      currentChapter = chapterOf(chapters, progress.resume().world) ?? chapters[0];
    }
    if (id === 'menu' || id === 'pause') home = id;
    current = id;
    currentWorld = world ?? currentWorld;
    root.hidden = false;
    draw();
  }

  onLangChange(draw);

  return {
    show,
    hide() {
      current = null;
      root.hidden = true;
      root.replaceChildren();
    },
    get current() {
      return current;
    },
  };
}
