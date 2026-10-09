import { FIXED_DT } from '../core/loop';

/**
 * Background music is generated, not recorded: each world has a scale, a tempo and a
 * timbre, and a small sequencer plays a looping arpeggio over four chords. No audio
 * files to download or license. Swap in recorded tracks later by replacing this module.
 */
export interface MusicDef {
  bpm: number;
  /** MIDI note of the scale's root. */
  root: number;
  /** Scale as semitones above the root. */
  scale: readonly number[];
  wave: OscillatorType;
  /** Lowpass cutoff for the lead, in Hz: lower is softer. */
  brightness: number;
}

export const MUSIC: Record<string, MusicDef> = {
  meadow: { bpm: 92, root: 62, scale: [0, 2, 4, 7, 9], wave: 'triangle', brightness: 2200 },
  ice: { bpm: 84, root: 69, scale: [0, 2, 4, 7, 9], wave: 'sine', brightness: 3200 },
  desert: { bpm: 96, root: 62, scale: [0, 1, 4, 5, 7, 8, 10], wave: 'triangle', brightness: 1800 },
  sky: { bpm: 104, root: 65, scale: [0, 2, 4, 5, 7, 9, 11], wave: 'triangle', brightness: 2800 },
  pirate: { bpm: 120, root: 62, scale: [0, 2, 3, 5, 7, 9, 10], wave: 'square', brightness: 1400 },
  magnet: { bpm: 100, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sawtooth', brightness: 1100 },
  gravity: { bpm: 76, root: 60, scale: [0, 2, 4, 6, 8, 10], wave: 'sine', brightness: 2400 },
  summit: { bpm: 100, root: 62, scale: [0, 2, 4, 7, 9], wave: 'square', brightness: 1500 },
  forest: { bpm: 88, root: 67, scale: [0, 2, 3, 7, 9], wave: 'triangle', brightness: 1900 },
  rooftop: { bpm: 108, root: 58, scale: [0, 3, 5, 6, 7, 10], wave: 'square', brightness: 1150 },
  clockwork: { bpm: 112, root: 64, scale: [0, 2, 4, 5, 7, 9, 11], wave: 'sine', brightness: 3600 },
  bomb: { bpm: 132, root: 55, scale: [0, 1, 3, 5, 6, 8, 10], wave: 'sawtooth', brightness: 1000 },
  midnight: { bpm: 124, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], wave: 'sawtooth', brightness: 1300 },
  // Chapter 3
  playroom: { bpm: 116, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], wave: 'square', brightness: 1700 },
  observatory: { bpm: 72, root: 57, scale: [0, 2, 3, 7, 8], wave: 'sine', brightness: 2600 },
  mirrors: { bpm: 106, root: 64, scale: [0, 2, 4, 6, 7, 9, 11], wave: 'triangle', brightness: 3000 },
  alley: { bpm: 128, root: 55, scale: [0, 3, 5, 6, 7, 10], wave: 'square', brightness: 1250 },
  carnival: { bpm: 136, root: 62, scale: [0, 2, 4, 7, 9], wave: 'sawtooth', brightness: 1500 },
  // Chapter 4
  tomb: { bpm: 80, root: 57, scale: [0, 1, 4, 5, 7, 8, 11], wave: 'triangle', brightness: 1500 },
  cavern: { bpm: 68, root: 64, scale: [0, 2, 4, 7, 9, 11], wave: 'sine', brightness: 3400 },
  jungle: { bpm: 110, root: 60, scale: [0, 2, 3, 5, 7, 10], wave: 'triangle', brightness: 1700 },
  hoard: { bpm: 96, root: 52, scale: [0, 2, 3, 6, 7, 8, 11], wave: 'sawtooth', brightness: 900 },
  temple: { bpm: 118, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], wave: 'square', brightness: 1400 },
  // Chapter 5
  reef: { bpm: 78, root: 62, scale: [0, 2, 4, 6, 7, 9, 11], wave: 'sine', brightness: 2000 },
  polar: { bpm: 90, root: 67, scale: [0, 2, 4, 7, 9], wave: 'triangle', brightness: 3400 },
  dam: { bpm: 102, root: 55, scale: [0, 2, 3, 5, 7, 9, 10], wave: 'square', brightness: 1200 },
  canyon: { bpm: 112, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sawtooth', brightness: 1300 },
  spring: { bpm: 126, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], wave: 'triangle', brightness: 2300 },
  // Chapter 6. On a hole that keeps a beat the tempo here is not used: the beat is the hole's.
  toy: { bpm: 122, root: 65, scale: [0, 2, 4, 7, 9], wave: 'square', brightness: 2000 },
  assembly: { bpm: 104, root: 55, scale: [0, 2, 3, 5, 7, 10], wave: 'sawtooth', brightness: 1100 },
  music: { bpm: 120, root: 57, scale: [0, 3, 5, 7, 10], wave: 'triangle', brightness: 2600 },
  clocktower: { bpm: 96, root: 62, scale: [0, 2, 3, 5, 7, 8, 11], wave: 'sine', brightness: 3000 },
  works: { bpm: 120, root: 60, scale: [0, 2, 3, 5, 7, 10], wave: 'square', brightness: 1500 },
  // Chapter 7
  subway: { bpm: 108, root: 57, scale: [0, 3, 5, 6, 7, 10], wave: 'sawtooth', brightness: 1000 },
  railway: { bpm: 114, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], wave: 'triangle', brightness: 2100 },
  funfair: { bpm: 138, root: 65, scale: [0, 2, 4, 5, 7, 9, 11], wave: 'square', brightness: 1900 },
  garden: { bpm: 86, root: 64, scale: [0, 2, 4, 7, 9], wave: 'sine', brightness: 3000 },
  cityday: { bpm: 126, root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle', brightness: 2000 },
  // Chapter 8
  phantom: { bpm: 82, root: 61, scale: [0, 2, 3, 7, 8], wave: 'sine', brightness: 2800 },
  endless: { bpm: 100, root: 65, scale: [0, 2, 4, 6, 7, 9, 11], wave: 'triangle', brightness: 2400 },
  looking: { bpm: 94, root: 58, scale: [0, 2, 3, 5, 7, 8, 11], wave: 'triangle', brightness: 1600 },
  echo: { bpm: 74, root: 64, scale: [0, 2, 5, 7, 9], wave: 'sine', brightness: 3200 },
  strange: { bpm: 116, root: 56, scale: [0, 1, 4, 6, 7, 10], wave: 'sawtooth', brightness: 1200 },
  // Chapter 9
  haunted: { bpm: 70, root: 57, scale: [0, 2, 3, 5, 7, 8, 11], wave: 'sine', brightness: 2200 },
  den: { bpm: 96, root: 52, scale: [0, 3, 5, 6, 7, 10], wave: 'sawtooth', brightness: 900 },
  dungeon: { bpm: 84, root: 55, scale: [0, 2, 3, 5, 7, 8, 10], wave: 'triangle', brightness: 1500 },
  lair: { bpm: 128, root: 50, scale: [0, 1, 3, 5, 6, 8, 10], wave: 'sawtooth', brightness: 1100 },
  castle: { bpm: 120, root: 52, scale: [0, 2, 3, 5, 7, 8, 11], wave: 'square', brightness: 1300 },
};

/** Chord roots, as scale steps, one per bar. */
const CHORDS = [0, 2, 3, 1];
/** Lead line: scale steps above the chord root for each 16th of a bar; -1 is a rest. */
const LEAD = [0, 2, 4, 2, 5, 4, 2, -1, 0, 2, 4, 7, 5, 4, 2, -1];
const STEPS_PER_BAR = 16;
/** How far ahead notes are scheduled, and how often the scheduler runs, in seconds. */
const LOOKAHEAD = 0.25;
const INTERVAL = 0.06;

export const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

/** The MIDI note a step of a world's scale is: step 0 is the root, and the scale goes on up through the octaves. */
export function scaleNote(def: MusicDef, degree: number): number {
  const n = def.scale.length;
  return def.root + def.scale[((degree % n) + n) % n] + 12 * Math.floor(degree / n);
}

/** One plucked note, at an exact moment of the audio clock. */
function pluck(
  ctx: AudioContext,
  output: AudioNode,
  def: MusicDef,
  midi: number,
  at: number,
  length: number,
  level: number,
  wave = def.wave,
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = midiToHz(midi);
  filter.type = 'lowpass';
  filter.frequency.value = def.brightness;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, at + length);
  osc.connect(filter).connect(gain).connect(output);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export class MusicPlayer {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private def: MusicDef | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {}

  play(id: string): void {
    const def = MUSIC[id] ?? MUSIC.meadow;
    if (def === this.def && this.timer !== null) return;
    this.stop();
    this.def = def;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), INTERVAL * 1000);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const def = this.def;
    if (!def) return;
    // After the tab was in the background the clock has moved on: skip, do not catch up.
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
    const stepLength = 60 / def.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      const inBar = this.step % STEPS_PER_BAR;
      const chord = CHORDS[Math.floor(this.step / STEPS_PER_BAR) % CHORDS.length];
      const lead = LEAD[inBar];
      if (lead >= 0) pluck(this.ctx, this.output, def, scaleNote(def, chord + lead) + 12, this.nextTime, stepLength * 1.8, 0.16);
      if (inBar % 8 === 0) pluck(this.ctx, this.output, def, scaleNote(def, chord) - 12, this.nextTime, stepLength * 7, 0.22, 'sine');
      this.nextTime += stepLength;
      this.step++;
    }
  }
}

/** How far ahead of the game's clock notes are put down, in ticks: more than a slow frame, less than anyone would notice a pause running on. */
const AHEAD = 12;
/** If the game's clock and the audio clock have come this far apart, in seconds, something stopped: start counting afresh. */
const DRIFT = 0.12;
/** A lead line for music that keeps a hole's beat: scale steps above the chord root for each half beat of two bars. */
const BEAT_LEAD = [0, 2, 4, 2, 5, 4, 2, 4, 0, 2, 4, 7, 5, 4, 2, -1];

/**
 * Music that follows the game (SPEC v6 3.4). On a hole that keeps a beat, the beat is
 * so many physics ticks, and every machine moves on it. This plays to the same count:
 * it is told the game's clock each frame and puts down the notes of the next fifth of
 * a second at the moments the audio clock will reach them. It never tells the game
 * anything, and it keeps no tempo of its own: stop the game and it stops, a beat late
 * at most; let the game fall behind and the music is brought back to it.
 */
export class BeatPlayer {
  private def: MusicDef | null = null;
  /** Ticks to a beat. */
  private beat = 30;
  /** The last half beat that has been put down. */
  private done = -1;
  /** Where on the audio clock the game's tick 0 falls, as best it is known. */
  private origin: number | null = null;
  private readonly noise: AudioBuffer;

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
  ) {
    this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.2), ctx.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }

  get playing(): boolean {
    return this.def !== null;
  }

  start(id: string, beat: number): void {
    this.def = MUSIC[id] ?? MUSIC.meadow;
    this.beat = beat;
    this.origin = null;
  }

  stop(): void {
    this.def = null;
    this.origin = null;
  }

  /** Call every frame the game is running, with its clock: the tick, and how far into the next. */
  follow(tick: number, alpha: number): void {
    const def = this.def;
    if (!def) return;
    const half = this.beat / 2;
    const now = this.ctx.currentTime;
    const clock = tick + alpha;
    const seen = now - clock * FIXED_DT;
    if (this.origin === null || Math.abs(seen - this.origin) > DRIFT) {
      // The first frame, or the game was paused, or started over: pick up from here.
      this.origin = seen;
      this.done = Math.ceil(clock / half) - 1;
    } else {
      // Frames come a little early and a little late. The count does not: lean on it.
      this.origin += (seen - this.origin) * 0.1;
    }
    for (let step = this.done + 1; step * half <= clock + AHEAD; step++) {
      const at = this.origin + step * half * FIXED_DT;
      if (at > now) this.play(def, step, at);
      this.done = step;
    }
  }

  private play(def: MusicDef, step: number, at: number): void {
    const beat = Math.floor(step / 2);
    const onBeat = step % 2 === 0;
    const inBar = beat % 4;
    const length = (this.beat / 2) * FIXED_DT;
    const chord = CHORDS[Math.floor(beat / 4) % CHORDS.length];
    const lead = BEAT_LEAD[step % BEAT_LEAD.length];
    if (lead >= 0) pluck(this.ctx, this.output, def, scaleNote(def, chord + lead) + 12, at, length * 1.7, 0.15);
    if (onBeat && inBar % 2 === 0) pluck(this.ctx, this.output, def, scaleNote(def, chord) - 12, at, length * 3.6, 0.24, 'sine');
    // The beat itself: a thump on every beat, heavier on the first of the bar, and a tick between.
    if (onBeat) this.thump(at, inBar === 0 ? 0.5 : 0.28);
    this.tick(at, onBeat ? 0.05 : 0.09);
  }

  private thump(at: number, level: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, at);
    osc.frequency.exponentialRampToValueAtTime(46, at + 0.11);
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.16);
    osc.connect(gain).connect(this.output);
    osc.start(at);
    osc.stop(at + 0.18);
  }

  private tick(at: number, level: number): void {
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.04);
    source.connect(filter).connect(gain).connect(this.output);
    source.start(at, 0, 0.06);
  }
}
