import { COLLECT, CREW, PROCESSOR, STORAGE } from './config';
import type { GameState } from './state';

// Simulation step. Mutates the state in place; `dt` is in game seconds.
// Order matters: energy is resolved first, because what has power decides what runs.

export function capacity(s: GameState) {
  const life = STORAGE.lifeBase + (s.levels.station - 1) * STORAGE.lifePerStationLevel;
  return {
    o2: life,
    water: life,
    food: life,
    energy: STORAGE.energyBase + s.counts.battery * STORAGE.energyPerBattery,
    regolith: STORAGE.regolithBase * s.levels.station,
    materials: STORAGE.materialsBase * s.levels.station,
  };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Life support shown on the HUD is the weakest of O2, water and food (in % of capacity). */
export function lifeSupportPercent(s: GameState): number {
  const cap = capacity(s);
  return Math.min(s.res.o2 / cap.o2, s.res.water / cap.water, s.res.food / cap.food) * 100;
}

/** What actually runs this step after power is resolved. */
export interface Running {
  processor: boolean;
  robots: boolean;
  heating: boolean;
  /** Effective grow-light brightness 0-100. */
  lights: number;
}

export function step(s: GameState, dt: number, running?: Running): void {
  const run = running ?? { processor: s.power.processor, robots: s.power.robots, heating: s.power.heating, lights: s.power.growLights };
  const cap = capacity(s);
  const active = s.crewHealth > 0; // with no healthy crew, production stops until recovered

  // Crew breathes, drinks and eats.
  s.res.o2 -= CREW.o2PerSecond * dt;
  s.res.water -= CREW.waterPerSecond * dt;
  s.res.food -= CREW.foodPerSecond * dt;

  // Regolith processor: regolith -> oxygen + building materials.
  if (active && run.processor && !s.sheltered && s.res.regolith > 0) {
    const rate = PROCESSOR.regolithPerSecond * (1 + 0.5 * (s.levels.processor - 1));
    const used = Math.min(s.res.regolith, rate * dt);
    s.res.regolith -= used;
    s.res.o2 += used * PROCESSOR.o2PerRegolith;
    s.res.materials += used * PROCESSOR.materialsPerRegolith;
  }

  // Collector robots dig on their own.
  if (active && run.robots && !s.sheltered && s.levels.collectorRobot > 0) {
    const got = COLLECT.robotPerSecond * s.levels.collectorRobot * dt;
    s.res.regolith += got;
    s.stats.regolithCollected += got;
  }

  // Crew health: drops while any life resource is empty, recovers when all are above 20 %.
  const empty = [s.res.o2, s.res.water, s.res.food].filter((v) => v <= 0).length;
  if (empty > 0) s.crewHealth -= CREW.healthLossPerEmpty * empty * dt;
  else if (lifeSupportPercent(s) > 20) s.crewHealth += CREW.healthRecovery * dt;
  s.crewHealth = clamp(s.crewHealth, 0, 100);

  for (const k of ['o2', 'water', 'food', 'regolith', 'materials'] as const) s.res[k] = clamp(s.res[k], 0, cap[k]);
  s.time += dt;
}

/** The player taps the surface to collect regolith by hand. */
export function collectByHand(s: GameState): number {
  const cap = capacity(s);
  const got = Math.min(COLLECT.regolithPerTap, cap.regolith - s.res.regolith);
  s.res.regolith += got;
  s.stats.regolithCollected += got;
  return got;
}
