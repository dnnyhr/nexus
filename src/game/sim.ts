import { COLLECT, CREW, ENERGY, PROCESSOR, STORAGE } from './config';
import { cyclePhase, type GameState } from './state';

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

// ---------------------------------------------------------------------------------------
// Energy: solar masts produce only during the lunar day; the battery carries the night.
// When the battery runs dry, systems are shed in order: grow lights, robots, processor,
// heating. Life support is always last. This is the night trade-off the player manages.

export interface PowerReport {
  generation: number;
  demand: number;
  running: Running;
  /** True when something the player turned on had to be shut off for lack of energy. */
  shortage: boolean;
  lifeSupportPowered: boolean;
}

export function resolvePower(s: GameState, dt: number, isDay: boolean): PowerReport {
  const generation = isDay ? s.counts.solarMast * ENERGY.solarPerMast : 0;
  const robotsCount = s.levels.collectorRobot + s.levels.harvesterRobot;
  const want = {
    lights: (s.power.growLights / 100) * ENERGY.growLightsMaxDraw * Math.min(1, s.levels.greenhouse),
    robots: s.power.robots && !s.sheltered && robotsCount > 0 ? ENERGY.robotDraw * robotsCount : 0,
    processor: s.power.processor && !s.sheltered ? ENERGY.processorDraw : 0,
    heating: s.power.heating && !isDay ? ENERGY.heatingDraw : 0,
  };
  let budget = s.res.energy / dt + generation - ENERGY.lifeSupportDraw;
  const lifeSupportPowered = budget >= 0;
  const on = { lights: 0, robots: false, processor: false, heating: false };
  // Grant in reverse shedding order: heating first, lights last.
  if (want.heating > 0 && budget >= want.heating) { on.heating = true; budget -= want.heating; }
  if (want.processor > 0 && budget >= want.processor) { on.processor = true; budget -= want.processor; }
  if (want.robots > 0 && budget >= want.robots) { on.robots = true; budget -= want.robots; }
  if (want.lights > 0 && budget > 0) on.lights = s.power.growLights * Math.min(1, budget / want.lights);

  const demand = ENERGY.lifeSupportDraw + (on.heating ? want.heating : 0) + (on.processor ? want.processor : 0) +
    (on.robots ? want.robots : 0) + (want.lights > 0 ? want.lights * (on.lights / Math.max(1, s.power.growLights)) : 0);
  const shortage = (want.heating > 0 && !on.heating) || (want.processor > 0 && !on.processor) ||
    (want.robots > 0 && !on.robots) || on.lights < s.power.growLights - 0.5;

  s.res.energy = clamp(s.res.energy + (generation - demand) * dt, 0, capacity(s).energy);
  return { generation, demand, running: { ...on }, shortage, lifeSupportPowered };
}

/** One full game update: time of day, power, resources. Returns the power report for the HUD. */
export function tick(s: GameState, dt: number): PowerReport {
  const { isDay } = cyclePhase(s.time);
  const report = resolvePower(s, dt, isDay);
  step(s, dt, report.running);
  if (!report.lifeSupportPowered) s.crewHealth = clamp(s.crewHealth - 0.3 * dt, 0, 100);
  return report;
}
