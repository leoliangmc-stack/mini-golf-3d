import { MusicPlayer } from './music';

interface ToneSpec {
  wave?: OscillatorType;
  /** Start and end frequency, in Hz. */
  from: number;
  to?: number;
  /** Length in seconds. */
  length: number;
  level: number;
  /** Seconds from now. */
  delay?: number;
}

interface NoiseSpec {
  length: number;
  level: number;
  filter: BiquadFilterType;
  from: number;
  to?: number;
  delay?: number;
}

/**
 * All sound, synthesised with Web Audio: no files to load, nothing to license. Every
 * method is safe to call before the player has tapped anything; it just stays silent
 * until `unlock` has run inside a user gesture, as browsers require.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private hum: { osc: OscillatorNode; gain: GainNode } | null = null;
  private sfxOn = true;
  private musicOn = true;
  private musicId: string | null = null;

  /** Call from a tap or click handler. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(ctx.destination);
    this.musicBus.connect(ctx.destination);
    this.music = new MusicPlayer(ctx, this.musicBus);

    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    this.applyVolumes();
    if (this.musicId) this.music.play(this.musicId);
    // Phones keep playing a hidden tab otherwise.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    // A call, Siri or another app's sound interrupts the context on iOS, and a resume
    // from outside a gesture may be refused: the next tap anywhere starts it again.
    document.addEventListener(
      'pointerdown',
      () => {
        if (ctx.state !== 'running') void ctx.resume();
      },
      { passive: true },
    );
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    this.applyVolumes();
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    this.applyVolumes();
  }

  /** Switches the background music to a world's theme. */
  playMusic(id: string): void {
    this.musicId = id;
    this.music?.play(id);
  }

  // --- Sound effects --------------------------------------------------------

  click(): void {
    this.tone({ from: 880, length: 0.04, level: 0.12 });
  }

  /** The stroke. `power` is 0..1. */
  hit(power: number): void {
    this.tone({ wave: 'triangle', from: 240, to: 90, length: 0.1, level: 0.2 + 0.35 * power });
    this.noise({ filter: 'highpass', from: 1800, length: 0.03, level: 0.1 + 0.2 * power });
  }

  /** The ball hitting something. `speed` is the change of velocity in m/s. */
  bounce(kind: 'wall' | 'ground' | 'mover' | 'prop', speed: number): void {
    const level = Math.min(1, speed / 9);
    if (kind === 'ground') {
      this.tone({ from: 120, to: 70, length: 0.09, level: 0.3 * level });
      return;
    }
    // A crate or a pin gives a woody knock, lower than a rail.
    const base = kind === 'mover' ? 250 : kind === 'prop' ? 320 : 430;
    this.tone({ wave: 'triangle', from: base, to: base * 0.6, length: 0.07, level: 0.28 * level });
    this.noise({ filter: 'bandpass', from: base * 3, length: 0.04, level: 0.16 * level });
  }

  /** The ball rolling onto a surface with its own character. */
  surface(id: string): void {
    if (id === 'ice') {
      this.noise({ filter: 'highpass', from: 5000, length: 0.18, level: 0.07 });
      this.tone({ from: 1900, to: 2600, length: 0.14, level: 0.05 });
    } else if (id === 'sand') {
      this.noise({ filter: 'lowpass', from: 700, to: 300, length: 0.22, level: 0.22 });
    }
  }

  outOfBounds(): void {
    this.tone({ from: 720, to: 110, length: 0.5, level: 0.2 });
    this.noise({ filter: 'lowpass', from: 1800, to: 300, length: 0.45, level: 0.14, delay: 0.2 });
  }

  holed(): void {
    this.tone({ from: 520, to: 240, length: 0.13, level: 0.3 });
    [523, 659, 784, 1047].forEach((hz, i) =>
      this.tone({ wave: 'triangle', from: hz, length: 0.16, level: 0.18, delay: 0.14 + i * 0.08 }),
    );
  }

  /** One chime per star earned. */
  stars(count: number): void {
    for (let i = 0; i < count; i++) {
      this.tone({ from: 880 * [1, 1.26, 1.5][i], length: 0.5, level: 0.2, delay: 0.25 + i * 0.22 });
    }
  }

  strokeLimit(): void {
    this.tone({ wave: 'triangle', from: 330, length: 0.2, level: 0.2 });
    this.tone({ wave: 'triangle', from: 247, length: 0.35, level: 0.2, delay: 0.2 });
  }

  worldComplete(): void {
    [523, 659, 784, 1047, 1319, 1568].forEach((hz, i) =>
      this.tone({ wave: 'triangle', from: hz, length: i === 5 ? 0.9 : 0.2, level: 0.2, delay: 0.9 + i * 0.13 }),
    );
  }

  /** A whole chapter finished: the world fanfare, then a held chord on top. */
  chapterComplete(): void {
    this.worldComplete();
    [784, 988, 1175, 1568].forEach((hz) =>
      this.tone({ wave: 'triangle', from: hz, length: 1.4, level: 0.14, delay: 1.75 }),
    );
  }

  /** A hard landing after a drop, e.g. onto a lower roof. `speed` is the change of velocity in m/s. */
  land(speed: number): void {
    const level = Math.min(1, speed / 8);
    this.tone({ from: 150, to: 48, length: 0.18, level: 0.42 * level });
    this.noise({ filter: 'lowpass', from: 520, to: 120, length: 0.16, level: 0.26 * level });
  }

  /** The ball going into a tunnel mouth: a hollow swoop down. */
  tunnelEnter(): void {
    this.tone({ from: 540, to: 150, length: 0.18, level: 0.24 });
    this.noise({ filter: 'bandpass', from: 900, to: 260, length: 0.16, level: 0.12 });
  }

  /** The ball coming out of the other mouth: the swoop back up, and a pop. */
  tunnelExit(): void {
    this.tone({ from: 170, to: 620, length: 0.15, level: 0.24 });
    this.tone({ wave: 'triangle', from: 780, length: 0.06, level: 0.16, delay: 0.14 });
  }

  /** The lid of the cup sliding open or shut. Kept quiet: it happens all through a hole. */
  cupLid(open: boolean): void {
    this.tone({ wave: 'triangle', from: open ? 880 : 1320, to: open ? 1320 : 740, length: 0.09, level: 0.09 });
    this.noise({ filter: 'highpass', from: 3200, length: 0.03, level: 0.05 });
  }

  /** One second off the countdown. */
  timerTick(): void {
    this.tone({ wave: 'square', from: 1250, length: 0.025, level: 0.05 });
  }

  /** One of the last seconds of the countdown. */
  timerWarn(): void {
    this.tone({ wave: 'square', from: 990, length: 0.11, level: 0.2 });
    this.tone({ wave: 'square', from: 990, length: 0.11, level: 0.2, delay: 0.16 });
  }

  /** A clock picked up: time added. */
  timeBonus(): void {
    [784, 1047, 1319].forEach((hz, i) =>
      this.tone({ wave: 'triangle', from: hz, length: 0.14, level: 0.2, delay: i * 0.06 }),
    );
  }

  /** The countdown ran out. */
  explode(): void {
    this.noise({ filter: 'lowpass', from: 1600, to: 60, length: 0.8, level: 0.7 });
    this.tone({ from: 95, to: 28, length: 0.7, level: 0.55 });
    this.noise({ filter: 'highpass', from: 2400, length: 0.08, level: 0.3 });
  }

  cannonLoad(): void {
    this.tone({ from: 170, to: 80, length: 0.18, level: 0.3 });
  }

  cannonFire(): void {
    this.noise({ filter: 'lowpass', from: 900, to: 90, length: 0.55, level: 0.55 });
    this.tone({ from: 110, to: 38, length: 0.5, level: 0.5 });
  }

  /** The ball getting bigger: a swell upward, and heavier at the end. */
  grow(): void {
    this.tone({ wave: 'triangle', from: 220, to: 660, length: 0.26, level: 0.24 });
    this.tone({ from: 110, to: 82, length: 0.22, level: 0.26, delay: 0.2 });
  }

  /** The ball getting smaller: the same swell, turned upside down and thinner. */
  shrink(): void {
    this.tone({ wave: 'triangle', from: 880, to: 1760, length: 0.2, level: 0.16 });
    this.tone({ wave: 'sine', from: 2100, length: 0.05, level: 0.1, delay: 0.19 });
  }

  /** One ball becoming two: a pluck that comes apart into two notes. */
  split(): void {
    this.tone({ wave: 'triangle', from: 520, length: 0.07, level: 0.22 });
    this.tone({ wave: 'triangle', from: 660, to: 880, length: 0.16, level: 0.18, delay: 0.06 });
    this.tone({ wave: 'triangle', from: 440, to: 330, length: 0.16, level: 0.18, delay: 0.06 });
  }

  /** Time stopping: everything winds down and holds its breath. */
  freeze(): void {
    this.tone({ wave: 'sawtooth', from: 620, to: 70, length: 0.32, level: 0.16 });
    this.noise({ filter: 'lowpass', from: 2600, to: 180, length: 0.3, level: 0.12 });
    this.tone({ wave: 'sine', from: 1480, length: 0.5, level: 0.07, delay: 0.1 });
  }

  /** Time running again: the wind-down played backwards. */
  resume(): void {
    this.tone({ wave: 'sawtooth', from: 90, to: 560, length: 0.2, level: 0.13 });
    this.noise({ filter: 'lowpass', from: 220, to: 2400, length: 0.18, level: 0.09 });
  }

  /** A stroke played in mid-air: the usual tick, with a ring to it. */
  airShot(power: number): void {
    this.hit(power);
    this.tone({ wave: 'sine', from: 1320, to: 1980, length: 0.14, level: 0.12 });
  }

  /** One pin going over. */
  pinDown(): void {
    this.tone({ wave: 'triangle', from: 300, to: 190, length: 0.08, level: 0.26 });
    this.noise({ filter: 'bandpass', from: 1100, to: 500, length: 0.07, level: 0.2 });
  }

  /** The last pin is down. */
  strike(): void {
    this.noise({ filter: 'bandpass', from: 1400, to: 380, length: 0.35, level: 0.32 });
    [523, 659, 784, 1047].forEach((hz, i) =>
      this.tone({ wave: 'triangle', from: hz, length: 0.2, level: 0.22, delay: 0.12 + i * 0.07 }),
    );
  }

  /** A cup rising out of the ground: its turn has come. */
  cupAppear(): void {
    this.tone({ from: 196, to: 392, length: 0.3, level: 0.2 });
    this.tone({ wave: 'triangle', from: 784, length: 0.24, level: 0.18, delay: 0.26 });
    this.tone({ wave: 'triangle', from: 1175, length: 0.3, level: 0.16, delay: 0.38 });
  }

  // --- Chapter 4: the works of the ruins ---

  /** A plate going down under something, or coming back up. */
  plate(down: boolean): void {
    this.tone({ wave: 'triangle', from: down ? 190 : 150, to: down ? 120 : 200, length: 0.09, level: 0.22 });
    this.noise({ filter: 'lowpass', from: 900, to: 300, length: 0.07, level: 0.14 });
  }

  /** A gate grinding open, or coming down shut. */
  gate(open: boolean): void {
    this.noise({ filter: 'bandpass', from: open ? 420 : 260, to: open ? 180 : 520, length: 0.32, level: 0.26 });
    this.tone({ from: open ? 110 : 70, to: open ? 70 : 55, length: 0.3, level: 0.2 });
    if (!open) this.tone({ wave: 'triangle', from: 90, to: 50, length: 0.16, level: 0.32, delay: 0.2 });
  }

  /** A block of stone starting to slide. */
  stoneSlide(): void {
    this.noise({ filter: 'bandpass', from: 320, to: 210, length: 0.26, level: 0.3 });
  }

  /** A block of stone that will not move. */
  stoneBlocked(): void {
    this.tone({ wave: 'triangle', from: 120, to: 80, length: 0.1, level: 0.3 });
  }

  /** A block settling on its square. */
  stoneLand(): void {
    this.tone({ from: 95, to: 55, length: 0.14, level: 0.34 });
  }

  crystalTurn(): void {
    this.tone({ from: 1320, to: 1760, length: 0.16, level: 0.14 });
    this.tone({ wave: 'triangle', from: 2640, length: 0.22, level: 0.08, delay: 0.05 });
  }

  /** Light reaching a receiver for the first time. */
  beamLock(): void {
    [1047, 1319, 1568].forEach((hz, i) =>
      this.tone({ from: hz, length: 0.3, level: 0.16, delay: i * 0.07 }),
    );
  }

  /** A link of a chain setting off: a bridge rising, a boulder rolling. */
  sliderStart(): void {
    this.noise({ filter: 'lowpass', from: 240, to: 520, length: 0.5, level: 0.26 });
    this.tone({ from: 60, to: 90, length: 0.5, level: 0.2 });
  }

  sliderStop(): void {
    this.tone({ wave: 'triangle', from: 110, to: 60, length: 0.18, level: 0.34 });
    this.noise({ filter: 'lowpass', from: 600, to: 200, length: 0.12, level: 0.2 });
  }

  coin(): void {
    this.tone({ wave: 'square', from: 1568, length: 0.06, level: 0.1 });
    this.tone({ wave: 'square', from: 2093, length: 0.2, level: 0.1, delay: 0.06 });
  }

  /** A bell or a pile of bones disturbed: the dragon may have heard. */
  bell(): void {
    this.tone({ wave: 'triangle', from: 880, length: 0.7, level: 0.22 });
    this.tone({ from: 1325, length: 0.5, level: 0.12 });
    this.tone({ from: 2210, length: 0.3, level: 0.06 });
  }

  dragonStir(): void {
    this.tone({ wave: 'sawtooth', from: 70, to: 48, length: 0.7, level: 0.2 });
  }

  dragonWake(): void {
    this.tone({ wave: 'sawtooth', from: 55, to: 130, length: 0.5, level: 0.3 });
    this.tone({ wave: 'sawtooth', from: 130, to: 60, length: 0.9, level: 0.3, delay: 0.45 });
    this.noise({ filter: 'lowpass', from: 500, to: 1600, length: 1.1, level: 0.24, delay: 0.2 });
  }

  /** A burst of fire starting. */
  fire(): void {
    this.noise({ filter: 'bandpass', from: 500, to: 1400, length: 0.7, level: 0.32 });
    this.noise({ filter: 'lowpass', from: 300, length: 0.9, level: 0.2 });
  }

  /** A stroke taken back. */
  undo(): void {
    this.tone({ wave: 'triangle', from: 520, to: 260, length: 0.18, level: 0.2 });
    this.tone({ wave: 'triangle', from: 390, to: 196, length: 0.2, level: 0.14, delay: 0.1 });
  }

  /** Entering (`on`) or leaving a gravity zone. */
  gravityShift(on: boolean): void {
    this.tone({ from: on ? 280 : 900, to: on ? 900 : 280, length: 0.28, level: 0.13 });
  }

  /** Magnet hum: `level` 0..1 is how deep in a field the ball is; red hums lower than blue. */
  setHum(level: number, attracts: boolean): void {
    if (!this.ctx || !this.sfxBus) return;
    if (!this.hum) {
      if (level <= 0) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(this.sfxBus);
      osc.start();
      this.hum = { osc, gain };
    }
    const now = this.ctx.currentTime;
    this.hum.gain.gain.setTargetAtTime(0.14 * Math.max(0, level), now, 0.08);
    this.hum.osc.frequency.setTargetAtTime((attracts ? 62 : 93) * (1 + 0.5 * level), now, 0.08);
  }

  // --- Synthesis ------------------------------------------------------------

  private applyVolumes(): void {
    if (!this.ctx || !this.sfxBus || !this.musicBus) return;
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
    this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
  }

  private tone(spec: ToneSpec): void {
    const { ctx, sfxBus } = this;
    if (!ctx || !sfxBus || !this.sfxOn || spec.level <= 0) return;
    const start = ctx.currentTime + (spec.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.wave ?? 'sine';
    osc.frequency.setValueAtTime(spec.from, start);
    if (spec.to) osc.frequency.exponentialRampToValueAtTime(spec.to, start + spec.length);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(spec.level, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + spec.length);
    osc.connect(gain).connect(sfxBus);
    osc.start(start);
    osc.stop(start + spec.length + 0.02);
  }

  private noise(spec: NoiseSpec): void {
    const { ctx, sfxBus, noiseBuffer } = this;
    if (!ctx || !sfxBus || !noiseBuffer || !this.sfxOn || spec.level <= 0) return;
    const start = ctx.currentTime + (spec.delay ?? 0);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = noiseBuffer;
    filter.type = spec.filter;
    filter.frequency.setValueAtTime(spec.from, start);
    if (spec.to) filter.frequency.exponentialRampToValueAtTime(spec.to, start + spec.length);
    gain.gain.setValueAtTime(spec.level, start);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + spec.length);
    source.connect(filter).connect(gain).connect(sfxBus);
    // Start somewhere in the buffer for variety, but never so late that it runs out
    // before the sound has ended.
    const play = spec.length + 0.02;
    const offset = Math.random() * Math.max(0, noiseBuffer.duration - play);
    source.start(start, offset, play);
  }
}
