import { describe, expect, it } from 'vitest';
import { fixedStepClock } from './loop';
import { tick } from './sim';
import { developedGame } from './testing';

function play(frames: number[], speed = 1) {
  const s = developedGame();
  s.savedAt = 0;
  const clock = fixedStepClock(0.25);
  let steps = 0;
  for (const f of frames) steps += clock.advance(f, () => { tick(s, 0.25); }, speed);
  return { s, steps };
}

describe('fixed-step clock', () => {
  it('runs whole steps and keeps the remainder for the next frame', () => {
    const clock = fixedStepClock(0.25);
    let n = 0;
    expect(clock.advance(0.1, () => { n++; })).toBe(0);
    expect(clock.advance(0.1, () => { n++; })).toBe(0);
    expect(clock.advance(0.1, () => { n++; })).toBe(1);
    expect(n).toBe(1);
    expect(clock.pending).toBeCloseTo(0.05, 9);
  });

  it('frame grouping does not change the simulated state for the same number of steps', () => {
    const smooth = play(Array(256).fill(1 / 64));
    const choppy = play(Array.from({ length: 64 }, (_, i) => (i % 2 ? 1 / 32 : 3 / 32)));
    expect(smooth.steps).toBe(16);
    expect(choppy.steps).toBe(16);
    expect(choppy.s).toEqual(smooth.s);
  });

  it('2x speed runs twice the steps for the same real time, with the same results per step', () => {
    const one = play(Array(64).fill(0.0625));
    const two = play(Array(32).fill(0.0625), 2);
    expect(one.steps).toBe(16);
    expect(two.steps).toBe(16);
    expect(two.s).toEqual(one.s);
  });

  it('a long stalled frame is capped, and nothing runs for zero, negative or invalid time', () => {
    const clock = fixedStepClock(0.25, { maxFrame: 0.1 });
    let n = 0;
    expect(clock.advance(30, () => { n++; })).toBe(0);
    expect(clock.advance(0, () => { n++; })).toBe(0);
    expect(clock.advance(-1, () => { n++; })).toBe(0);
    expect(clock.advance(Number.NaN, () => { n++; })).toBe(0);
    expect(clock.advance(0.1, () => { n++; }, Number.POSITIVE_INFINITY)).toBe(0);
    expect(n).toBe(0);
  });

  it('stops when a step says so and drops the remainder', () => {
    const clock = fixedStepClock(0.25, { maxFrame: 10 });
    let n = 0;
    expect(clock.advance(2, () => ++n < 3)).toBe(3);
    expect(clock.pending).toBe(0);
  });

  it('reset drops pending time (used after a pause or a state swap)', () => {
    const clock = fixedStepClock(0.25);
    clock.advance(0.2, () => {});
    clock.reset();
    expect(clock.advance(0.1, () => {})).toBe(0);
  });

  it('rejects an invalid step size', () => {
    expect(() => fixedStepClock(0)).toThrow();
    expect(() => fixedStepClock(Number.POSITIVE_INFINITY)).toThrow();
  });
});
