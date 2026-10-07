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
};

/** Chord roots, as scale steps, one per bar. */
const CHORDS = [0, 2, 3, 1];
/** Lead line: scale steps above the chord root for each 16th of a bar; -1 is a rest. */
const LEAD = [0, 2, 4, 2, 5, 4, 2, -1, 0, 2, 4, 7, 5, 4, 2, -1];
const STEPS_PER_BAR = 16;
/** How far ahead notes are scheduled, and how often the scheduler runs, in seconds. */
const LOOKAHEAD = 0.25;
const INTERVAL = 0.06;

const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

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
      if (lead >= 0) this.pluck(def, this.note(def, chord + lead) + 12, this.nextTime, stepLength * 1.8, 0.16);
      if (inBar % 8 === 0) this.pluck(def, this.note(def, chord) - 12, this.nextTime, stepLength * 7, 0.22, 'sine');
      this.nextTime += stepLength;
      this.step++;
    }
  }

  private note(def: MusicDef, degree: number): number {
    const n = def.scale.length;
    return def.root + def.scale[((degree % n) + n) % n] + 12 * Math.floor(degree / n);
  }

  private pluck(def: MusicDef, midi: number, at: number, length: number, level: number, wave = def.wave): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = midiToHz(midi);
    filter.type = 'lowpass';
    filter.frequency.value = def.brightness;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + length);
    osc.connect(filter).connect(gain).connect(this.output);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }
}
