import { describe, expect, it } from 'vitest';
import { BeatPlayer } from '../src/audio/music';

/**
 * Just enough of an AudioContext to see what is put down and for when. Every sound the
 * player makes starts a source, and each source is started at a moment of the audio clock.
 */
function fakeAudio() {
  const starts: { kind: 'osc' | 'noise'; at: number; hz: number }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect: (next: unknown) => next });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param() }),
    createOscillator: () => {
      const frequency = { ...param(), setValueAtTime(hz: number) { frequency.value = hz; } };
      return { ...node(), type: '', frequency, start: (at: number) => starts.push({ kind: 'osc', at, hz: frequency.value }), stop() {} };
    },
    createBufferSource: () => ({ ...node(), buffer: null, start: (at: number) => starts.push({ kind: 'noise', at, hz: 0 }) }),
  };
  return { ctx, starts };
}

/** Runs the game's clock in step with the audio clock for a while, a frame at a time, frames a little uneven. */
function run(
  audio: ReturnType<typeof fakeAudio>,
  player: BeatPlayer,
  clock: { game: number },
  seconds: number,
  speed = 1,
): void {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    const jitter = ((i * 37) % 11) / 11 - 0.5;
    const dt = (1 + jitter * 0.5) / 60;
    audio.ctx.currentTime += dt;
    clock.game += dt * 60 * speed;
    player.follow(Math.floor(clock.game), clock.game - Math.floor(clock.game));
  }
}

/** The moments something was struck: one tick of noise goes with every half beat. */
const steps = (audio: ReturnType<typeof fakeAudio>) => audio.starts.filter((start) => start.kind === 'noise').map((start) => start.at);

describe('music that keeps a hole\'s beat (SPEC v6 3.4, 7.4 #4)', () => {
  it('puts every half beat down once, at the moment the game will get to it', () => {
    const audio = fakeAudio();
    const player = new BeatPlayer(audio.ctx as unknown as AudioContext, {} as AudioNode);
    const clock = { game: 0 };
    player.start('music', 30);
    run(audio, player, clock, 12);
    const at = steps(audio);
    // 120 beats a minute: a half beat every quarter of a second, for twelve seconds.
    expect(at.length).toBeGreaterThan(44);
    expect(at.length).toBeLessThan(50);
    for (let i = 1; i < at.length; i++) {
      // Frames came up to 8 ms early or late. The beat never moves by more than 2.
      expect(Math.abs(at[i] - at[i - 1] - 0.25)).toBeLessThan(0.002);
    }
    // And it is where the game's clock says it is: tick 30 * n is at n half-seconds.
    const offset = audio.ctx.currentTime - clock.game / 60;
    for (const moment of at) {
      const halfBeats = (moment - offset) / 0.25;
      expect(Math.abs(halfBeats - Math.round(halfBeats))).toBeLessThan(0.03);
    }
  });

  it('plays a thump on every beat, and nothing behind the clock', () => {
    const audio = fakeAudio();
    const player = new BeatPlayer(audio.ctx as unknown as AudioContext, {} as AudioNode);
    const clock = { game: 0 };
    player.start('music', 30);
    let late = 0;
    const frames = 600;
    for (let i = 0; i < frames; i++) {
      const before = audio.starts.length;
      run(audio, player, clock, 1 / 60);
      for (const start of audio.starts.slice(before)) if (start.at < audio.ctx.currentTime - 1 / 60) late++;
    }
    expect(late).toBe(0);
    // The thump on each beat starts at 140 Hz: one to a beat, for seven seconds and a half.
    const thumps = audio.starts.filter((start) => start.kind === 'osc' && start.hz === 140);
    expect(thumps.length).toBeGreaterThan(13);
    for (let i = 1; i < thumps.length; i++) expect(thumps[i].at - thumps[i - 1].at).toBeCloseTo(0.5, 2);
  });

  it('stops with the game and picks up where the game does, without a burst of what it missed', () => {
    const audio = fakeAudio();
    const player = new BeatPlayer(audio.ctx as unknown as AudioContext, {} as AudioNode);
    const clock = { game: 0 };
    player.start('music', 30);
    run(audio, player, clock, 4);
    const before = steps(audio).length;
    const last = Math.max(...steps(audio));
    // Paused for ten seconds: the audio clock runs on, the game's does not, and nobody calls.
    audio.ctx.currentTime += 10;
    expect(steps(audio).length).toBe(before);
    // Nothing was put down further ahead than a fifth of a second.
    expect(last).toBeLessThan(audio.ctx.currentTime - 10 + 0.25);
    run(audio, player, clock, 1 / 60);
    expect(steps(audio).length - before).toBeLessThanOrEqual(1);
    run(audio, player, clock, 4);
    const after = steps(audio).slice(before);
    expect(after.length).toBeGreaterThan(14);
    expect(Math.min(...after)).toBeGreaterThan(last + 9);
    for (let i = 1; i < after.length; i++) expect(Math.abs(after[i] - after[i - 1] - 0.25)).toBeLessThan(0.002);
  });

  it('starts over with the hole: a retry sends the game back to tick 0, and the music with it', () => {
    const audio = fakeAudio();
    const player = new BeatPlayer(audio.ctx as unknown as AudioContext, {} as AudioNode);
    const clock = { game: 0 };
    player.start('music', 30);
    run(audio, player, clock, 3.3);
    const before = steps(audio).length;
    clock.game = 0;
    run(audio, player, clock, 3);
    const after = steps(audio).slice(before);
    const offset = audio.ctx.currentTime - clock.game / 60;
    expect(after.length).toBeGreaterThan(10);
    for (const moment of after) {
      const halfBeats = (moment - offset) / 0.25;
      expect(Math.abs(halfBeats - Math.round(halfBeats))).toBeLessThan(0.03);
    }
  });

  it('says nothing until it is started, and nothing once it is stopped', () => {
    const audio = fakeAudio();
    const player = new BeatPlayer(audio.ctx as unknown as AudioContext, {} as AudioNode);
    const clock = { game: 0 };
    run(audio, player, clock, 2);
    expect(audio.starts).toHaveLength(0);
    player.start('music', 30);
    run(audio, player, clock, 2);
    const some = audio.starts.length;
    expect(some).toBeGreaterThan(0);
    player.stop();
    run(audio, player, clock, 2);
    expect(audio.starts).toHaveLength(some);
  });
});
