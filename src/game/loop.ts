// Fixed-step clock. The render loop reports real frame time; the simulation only ever advances
// in whole steps. Frame rate, frame grouping, pauses and speed change how many steps run per
// frame, never what each step computes. No timers, no wall clock: the caller feeds time.

export interface FixedStepOptions {
  /** Longest real frame taken into account, so a stalled tab does not fast-forward. */
  maxFrame?: number;
  /** Most steps run in one frame. */
  maxSteps?: number;
}

export interface FixedStepClock {
  readonly stepSeconds: number;
  /** Simulated seconds waiting to become a whole step. */
  readonly pending: number;
  /**
   * Feed one real frame at `speed`. Runs `step` once per whole step and returns how many ran.
   * `step` may return false to stop early (for example when a mission ends).
   */
  advance(frameSeconds: number, step: () => boolean | void, speed?: number): number;
  /** Drop the leftover fraction, after a pause or when the simulated state is replaced. */
  reset(): void;
}

export function fixedStepClock(stepSeconds: number, opts: FixedStepOptions = {}): FixedStepClock {
  if (!(stepSeconds > 0) || !Number.isFinite(stepSeconds)) throw new Error('Paso inválido');
  const maxFrame = opts.maxFrame ?? 0.1;
  const maxSteps = opts.maxSteps ?? 64;
  let acc = 0;
  return {
    stepSeconds,
    get pending() { return acc; },
    advance(frameSeconds, step, speed = 1) {
      if (!(frameSeconds > 0) || !(speed > 0) || !Number.isFinite(frameSeconds) || !Number.isFinite(speed)) return 0;
      acc += Math.min(frameSeconds, maxFrame) * speed;
      let ran = 0;
      while (acc >= stepSeconds && ran < maxSteps) {
        acc -= stepSeconds;
        ran++;
        if (step() === false) { acc = 0; break; }
      }
      if (ran === maxSteps) acc = Math.min(acc, stepSeconds);
      return ran;
    },
    reset() { acc = 0; },
  };
}
