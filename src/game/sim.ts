import { COLLECT, CREW, DAMAGE, ENERGY, GREENHOUSE, POWER, PROCESSOR, STORAGE, type Circuit } from './config';
import { batteriesCapacity, damageOf, processorFactor, solarMastsOutput } from './damage';
import { priorityOf } from './power';
import { cyclePhase, type GameState } from './state';

// Simulation step. Mutates the state in place; `dt` is in game seconds.
// Order matters: energy is resolved first, because what has power decides what runs.

export function capacity(s: GameState) {
  const tier = Math.max(1, s.levels.station);
  const life = STORAGE.lifeBase + (tier - 1) * STORAGE.lifePerStationLevel;
  return {
    o2: life,
    water: life,
    food: life,
    energy: STORAGE.energyBase + batteriesCapacity(s) * STORAGE.energyPerBattery,
    regolith: STORAGE.regolithBase * tier,
    materials: STORAGE.materialsBase * tier,
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
  const run = running ?? { processor: s.power.processor, robots: s.power.robots, heating: s.power.heating, lights: s.power.greenhouse ? s.power.growLights : 0 };
  const cap = capacity(s);
  const active = s.crewHealth > 0; // with no healthy crew, production stops until recovered

  // Crew breathes, drinks and eats.
  s.res.o2 -= (CREW.o2PerSecond + DAMAGE.stationO2Leak * damageOf(s, 'station')) * dt;
  s.res.water -= CREW.waterPerSecond * dt;
  s.res.food -= CREW.foodPerSecond * dt;

  // Regolith processor: regolith -> oxygen + building materials.
  if (active && s.levels.processor > 0 && run.processor && !s.sheltered && s.res.regolith > 0) {
    const rate = PROCESSOR.regolithPerSecond * (1 + 0.5 * (s.levels.processor - 1)) * processorFactor(s);
    const used = Math.min(s.res.regolith, rate * dt);
    s.res.regolith -= used;
    s.res.o2 += used * PROCESSOR.o2PerRegolith;
    s.res.materials += used * PROCESSOR.materialsPerRegolith;
    s.stats.materialsMade += used * PROCESSOR.materialsPerRegolith;
  }


  // Crew health: drops while any life resource is empty, recovers when all are above 20 %.
  const empty = [s.res.o2, s.res.water, s.res.food].filter((v) => v <= 0).length;
  if (empty > 0) s.crewHealth -= CREW.healthLossPerEmpty * empty * dt;
  else if (lifeSupportPercent(s) > 20) s.crewHealth += CREW.healthRecovery * dt;
  s.crewHealth = clamp(s.crewHealth, 0, 100);

  for (const k of ['o2', 'water', 'food', 'regolith', 'materials'] as const) s.res[k] = clamp(s.res[k], 0, cap[k]);
  s.time += dt;
}

/**
 * The astronaut digs regolith into the bag. It is only useful once delivered to the
 * processor with deliverRegolith(). Returns how much went into the bag (0 when full).
 */
export function carryMax(s: GameState): number {
  return COLLECT.bagCapacity[Math.min(Math.max(1, s.levels.bag), 3) - 1];
}

export function digYield(s: GameState): number {
  return COLLECT.digPerLevel[Math.min(Math.max(1, s.levels.bag), 3) - 1];
}

export function collectByHand(s: GameState): number {
  const got = Math.min(digYield(s), carryMax(s) - s.carried);
  s.carried += got;
  s.stats.regolithCollected += got;
  return got;
}

/** A collector robot unloads one trip into the processor's hopper. Returns the amount. */
export function robotUnload(s: GameState): number {
  if (s.levels.processor === 0 || s.levels.collectorRobot === 0) return 0;
  const load = COLLECT.robotLoad[Math.min(3, s.levels.collectorRobot) - 1];
  const amount = Math.min(load, capacity(s).regolith - s.res.regolith);
  s.res.regolith += amount;
  s.stats.regolithCollected += amount;
  return amount;
}

/** Empty the bag into the processor's hopper (limited by its storage). Returns the amount. */
export function deliverRegolith(s: GameState): number {
  if (s.levels.processor === 0) return 0;
  const room = capacity(s).regolith - s.res.regolith;
  const amount = Math.min(s.carried, room);
  s.carried -= amount;
  s.res.regolith += amount;
  return amount;
}

// ---------------------------------------------------------------------------------------
// Energy: solar masts produce only during the lunar day; the battery carries the night.
// When power falls short, circuits are fed in the player's priority order and the rest are
// shed. The default order is the one the game always had: grow lights, robots, processor,
// heating are shed in that order and life support is last. This is the night trade-off.

export interface PowerReport {
  generation: number;
  demand: number;
  /** Power that could be used this step: generation plus what the batteries can deliver. */
  available?: number;
  running: Running;
  /** True when something the player turned on had to be shut off for lack of energy. */
  shortage: boolean;
  lifeSupportPowered: boolean;
  /** Circuits that wanted power and did not get all of it, in POWER.circuits order. */
  shed?: Circuit[];
}

export interface PowerOptions {
  /** Most the batteries can deliver per second (power, not capacity). Free mode has no limit. */
  dischargeLimit?: number;
  /** Multiplies the grow-light draw (the mission scales it with the greenhouse level). */
  lightsDrawScale?: number;
  /** Grow lights get no power (the mission suspends farming in the shelter). */
  lightsSuspended?: boolean;
}

export function resolvePower(s: GameState, dt: number, isDay: boolean, opts: PowerOptions = {}): PowerReport {
  const generation = isDay ? ENERGY.landerSolar + solarMastsOutput(s) * ENERGY.solarPerMast : 0;
  const robotsCount = s.levels.collectorRobot + s.levels.harvesterRobot;
  const lights = s.power.greenhouse && !opts.lightsSuspended ? s.power.growLights : 0;
  const want: Record<Circuit, number> = {
    lifeSupport: ENERGY.lifeSupportDraw,
    greenhouse: (lights / 100) * ENERGY.growLightsMaxDraw * Math.min(1, s.levels.greenhouse) * (opts.lightsDrawScale ?? 1),
    // Robots also park during a solar storm to protect their electronics.
    robots: s.power.robots && !s.sheltered && s.storm.phase !== 'active' && robotsCount > 0 ? ENERGY.robotDraw * robotsCount : 0,
    processor: s.levels.processor > 0 && s.power.processor && !s.sheltered ? ENERGY.processorDraw : 0,
    heating: s.power.heating && !isDay ? ENERGY.heatingDraw : 0,
  };
  const stored = s.res.energy / dt;
  const limited = opts.dischargeLimit === undefined ? stored : Math.min(stored, Math.max(0, opts.dischargeLimit));
  const available = limited + generation;
  let budget = available;
  let lifeSupportPowered = false;
  const on = { lights: 0, robots: false, processor: false, heating: false };
  for (const c of priorityOf(s)) {
    if (c === 'lifeSupport') {
      // A critical load: it takes its share even when that leaves nothing for the rest.
      budget -= want.lifeSupport;
      lifeSupportPowered = budget >= 0;
    } else if (c === 'greenhouse') {
      // LEDs dim: the greenhouse takes whatever part of its draw is left.
      if (want.greenhouse > 0 && budget > 0) {
        const share = Math.min(1, budget / want.greenhouse);
        on.lights = lights * share;
        budget -= want.greenhouse * share;
      }
    } else if (want[c] > 0 && budget >= want[c]) {
      on[c] = true;
      budget -= want[c];
    }
  }

  const demand = ENERGY.lifeSupportDraw + (on.heating ? want.heating : 0) + (on.processor ? want.processor : 0) +
    (on.robots ? want.robots : 0) + (want.greenhouse > 0 ? want.greenhouse * (on.lights / Math.max(1, lights)) : 0);
  const shortage = (want.heating > 0 && !on.heating) || (want.processor > 0 && !on.processor) ||
    (want.robots > 0 && !on.robots) || on.lights < lights - 0.5;
  const shed = POWER.circuits.filter((c) =>
    c === 'lifeSupport' ? !lifeSupportPowered
      : c === 'greenhouse' ? want.greenhouse > 0 && on.lights < lights - 1e-9
        : want[c] > 0 && !on[c]);

  // The batteries cannot give more than their discharge limit, even in a brownout.
  const floor = opts.dischargeLimit === undefined ? 0 : Math.max(0, s.res.energy - limited * dt);
  s.res.energy = clamp(s.res.energy + (generation - demand) * dt, floor, capacity(s).energy);
  return { generation, demand, available, running: { ...on }, shortage, lifeSupportPowered, shed };
}

/** One full game update: time of day, power, resources. Returns the power report for the HUD. */
export function tick(s: GameState, dt: number): PowerReport {
  const { isDay } = cyclePhase(s.time);
  const report = resolvePower(s, dt, isDay);
  step(s, dt, report.running);
  stepGreenhouse(s, dt, isDay, report.running);
  if (!report.lifeSupportPowered) s.crewHealth = clamp(s.crewHealth - 0.3 * dt, 0, 100);
  return report;
}

// ---------------------------------------------------------------------------------------
// Greenhouse: the part of the game that is always manual. Water, light and temperature must
// stay in the optimal range (40-60). Each parameter out of range adds stress; high stress
// stops growth, and staying at max stress kills the plant. The harvester robot only picks
// plants that are ready; it never adjusts the parameters.

export function inRange(v: number): boolean {
  return v >= GREENHOUSE.optimalMin && v <= GREENHOUSE.optimalMax;
}

export function stepGreenhouse(s: GameState, dt: number, isDay: boolean, run: Running, offline = false): void {
  const p = s.plant;
  if (p.dead || s.levels.greenhouse === 0) return;
  const k = offline ? GREENHOUSE.offlineFactor : 1;

  p.water = clamp(p.water + GREENHOUSE.waterDrift * (1 + DAMAGE.greenhouseLeak * damageOf(s, 'greenhouse')) * k * dt, 0, 100);
  // Light follows the LED brightness the power system could actually deliver.
  p.light = clamp(p.light + (run.lights - p.light) * Math.min(1, 2 * dt), 0, 100);
  const tempDrift = isDay ? GREENHOUSE.tempDayDrift : run.heating ? GREENHOUSE.tempDayDrift * 0.3 : GREENHOUSE.tempNightDrift;
  p.temp = clamp(p.temp + tempDrift * k * dt, 0, 100);

  const bad = [p.water, p.light, p.temp].filter((v) => !inRange(v)).length;
  p.stress = bad > 0 ? p.stress + GREENHOUSE.stressPerBadParam * bad * k * dt : p.stress - GREENHOUSE.stressRecovery * dt;
  // Offline, plants can wilt but never die.
  p.stress = clamp(p.stress, 0, offline ? 99 : 100);

  if (p.stress < GREENHOUSE.stressNoGrowth) p.growth = clamp(p.growth + GREENHOUSE.growthPerSecond * dt, 0, 100);

  if (p.stress >= 100) {
    p.maxStressTime += dt;
    if (p.maxStressTime >= GREENHOUSE.deathSeconds) p.dead = true;
  } else {
    p.maxStressTime = 0;
  }

  // The harvester robot picks ready plants on its own.
  if (p.growth >= 100 && s.levels.harvesterRobot > 0 && run.robots) harvest(s);
}

/** Pick a ready plant: adds food and starts a new one. Returns the food gained. */
export function harvest(s: GameState): number {
  if (s.plant.dead || s.plant.growth < 100) return 0;
  const food = GREENHOUSE.foodPerHarvestPerLevel * s.levels.greenhouse;
  s.res.food = Math.min(capacity(s).food, s.res.food + food);
  s.plant.growth = 0;
  s.stats.harvests += 1;
  return food;
}

/** Water the plant: costs water from storage. Too much water rots the roots (above 60). */
export function irrigate(s: GameState): boolean {
  if (s.plant.dead || s.res.water < GREENHOUSE.waterPerIrrigation) return false;
  s.res.water -= GREENHOUSE.waterPerIrrigation;
  s.plant.water = clamp(s.plant.water + GREENHOUSE.irrigationAmount, 0, 100);
  return true;
}

/** Heat (+1) or cool (-1) the greenhouse: costs energy. */
export function adjustClimate(s: GameState, dir: 1 | -1): boolean {
  if (s.plant.dead || s.res.energy < GREENHOUSE.climateEnergy) return false;
  s.res.energy -= GREENHOUSE.climateEnergy;
  s.plant.temp = clamp(s.plant.temp + dir * GREENHOUSE.climateStep, 0, 100);
  return true;
}

/** Plant again after a plant died: costs materials. */
export function replant(s: GameState): boolean {
  if (!s.plant.dead || s.res.materials < GREENHOUSE.replantMaterials) return false;
  s.res.materials -= GREENHOUSE.replantMaterials;
  s.plant = { water: 50, light: s.power.growLights, temp: 50, growth: 0, stress: 0, maxStressTime: 0, dead: false };
  return true;
}
