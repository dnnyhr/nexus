import { SHIELD, STORM } from './config';
import type { GameState } from './state';
import { flareStrength, radiationScale, type Flare } from '../data/spaceweather';

// Solar storms. A flare on the Sun can release energetic particles that reach the Moon in
// minutes to hours. The Moon has no atmosphere or magnetic field, so the astronaut must get
// into a shielded shelter. Each storm in the game recreates a real recent flare from NASA
// DONKI; its X-ray class sets how strong it is and how much warning there is.

export type StormEvent = 'warning' | 'active' | 'end' | null;

/** Protection 0-1 against particles where the astronaut is now. */
export function protection(s: GameState): number {
  if (!s.sheltered) return STORM.suitProtection;
  if (!s.levels.station) return STORM.landerProtection;
  return Math.min(0.97, (SHIELD.base + SHIELD.perBermLevel * s.levels.shield + SHIELD.shelterBonus) / 100);
}

/** Strongest flares first, so the first storms are the memorable ones. */
export function pickFlare(flares: Flare[], used: number): Flare | null {
  if (!flares.length) return null;
  const sorted = [...flares].sort((a, b) => flareStrength(b.class) - flareStrength(a.class));
  const strong = sorted.filter((f) => f.class[0] === 'M' || f.class[0] === 'X');
  const pool = strong.length ? strong : sorted;
  return pool[used % pool.length];
}

export function startStorm(s: GameState, flare: Flare | null, live = false, strengthOverride?: number): void {
  const strength = strengthOverride ?? (flare ? flareStrength(flare.class) : 0.4);
  s.storm = {
    ...s.storm,
    phase: 'warning',
    timeLeft: STORM.warnMax - (STORM.warnMax - STORM.warnMin) * strength,
    strength,
    flare: flare ? { id: flare.id, class: flare.class, peak: flare.peak, link: flare.link } : null,
    used: s.storm.used + (flare ? 1 : 0),
    live,
  };
}

/** Dose rate (mSv/s) where the astronaut is, during an active storm. */
export function doseRate(s: GameState): number {
  if (s.storm.phase !== 'active') return 0;
  const outside = STORM.doseMin + (STORM.doseMax - STORM.doseMin) * s.storm.strength;
  return outside * (1 - protection(s));
}

/**
 * Advance storms. `enabled` once the missions reach the point where storms matter;
 * `liveFlux` is the current GOES ≥10 MeV proton flux, which triggers a real storm at S1+.
 */
export function stepStorm(s: GameState, dt: number, enabled: boolean, flares: Flare[], liveFlux = 0): StormEvent {
  const st = s.storm;
  if (st.phase === 'none') {
    if (!enabled) return null;
    const scale = radiationScale(liveFlux);
    if (scale > 0 && !st.live) {
      startStorm(s, null, true, Math.min(1, 0.4 + 0.15 * scale));
      return 'warning';
    }
    st.nextIn -= dt;
    if (st.nextIn > 0) return null;
    startStorm(s, pickFlare(flares, st.used));
    return 'warning';
  }
  st.timeLeft -= dt;
  if (st.phase === 'active') {
    const rate = doseRate(s);
    s.dose += rate * dt;
    s.crewHealth = Math.max(0, s.crewHealth - rate * STORM.healthPerMsv * dt);
  }
  if (st.timeLeft > 0) return null;
  if (st.phase === 'warning') {
    st.phase = 'active';
    st.timeLeft = STORM.durationMin + (STORM.durationMax - STORM.durationMin) * st.strength;
    return 'active';
  }
  st.phase = 'none';
  st.nextIn = STORM.meanInterval * (0.6 + Math.random() * 0.8);
  return 'end';
}
