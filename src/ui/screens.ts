import type { HoleRef, Progress, Quality } from '../app/progress';
import { chapterOf, holeNumber, stagesOf } from '../level/chapters';
import type { ChapterDef, WorldDef } from '../level/schema';
import { byId, el } from './dom';
import { getLang, onLangChange, setLang, TEXT, tr, type Lang } from './i18n';

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
  /**
   * A picture of a world, as an image URL, if one is ready. Otherwise null now, and
   * `later` is called with it once it has been made: a page of cards asks for several
   * at once, and making them all before the page can show would stall a phone.
   */
  thumbnail(world: WorldDef, later: (url: string) => void): string | null;
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

  const header = (title: string, back: () => void) =>
    el('header', { className: 'screen-header' }, button(`‹ ${TEXT.back()}`, back, 'ghost'), el('h2', { textContent: title }));

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
    const picture = el('div', { className: open ? 'world-picture' : 'world-picture locked' });
    const showPicture = (url: string) => {
      picture.style.backgroundImage = `url(${url})`;
    };
    const image = actions.thumbnail(world, showPicture);
    if (image) showPicture(image);
    if (!open) picture.append(el('span', { textContent: '🔒' }));
    card.append(
      picture,
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
    return [
      header(TEXT.worlds(), () => show(home)),
      el('div', { className: 'tabs', role: 'tablist' }, ...tabs),
      ...locked,
      el(
        'div',
        { className: 'world-grid' },
        ...chapter.worlds.map((world, i) => worldCard(world, String(worldsBefore + i + 1), false)),
        worldCard(chapter.finale, '⚑', true),
      ),
    ];
  };

  const worldDetail = (world: WorldDef) => {
    const chapter = chapterOf(chapters, world);
    // A finale goes by its number in the chapter: hole 19, not hole 1.
    const number = (index: number) =>
      chapter?.finale === world ? holeNumber(chapter, world, index) : index + 1;
    return [
      header(tr(world.name), () => show('worlds')),
      el('p', { className: 'rule', textContent: tr(world.ruleCard) }),
      el(
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
      ),
    ];
  };

  /** A row of mutually exclusive choices. */
  const choice = <T>(label: string, options: [T, string][], value: T, onPick: (value: T) => void) =>
    el(
      'div',
      { className: 'setting' },
      el('span', { textContent: label }),
      el(
        'div',
        { className: 'segments' },
        ...options.map(([option, text]) => button(text, () => onPick(option), option === value ? 'on' : '')),
      ),
    );

  const settings = () => {
    const s = progress.settings;
    const change = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
      progress.setSetting(key, value);
      actions.settingsChanged();
      // A language change redraws through onLangChange; everything else redraws here.
      if (key !== 'lang') show('settings');
    };
    return [
      header(TEXT.settings(), () => show(home)),
      el(
        'div',
        { className: 'settings' },
        choice<Lang>(TEXT.language(), [['zh', '中文'], ['en', 'English']], getLang(), (lang) => {
          change('lang', lang);
          setLang(lang);
        }),
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
