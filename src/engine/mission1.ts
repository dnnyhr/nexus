import type { DesignItem, Scenario } from './types';

// Mission 1 «Primera oscuridad»: a fixed scenario, so every run with the same design and
// the same commands at the same times ends the same way. Nothing here reads the clock, the
// network or Math.random. The flare is the real M6.7 from the dated DONKI snapshot, used as
// context for the storm; the storm itself is didactic (strength and timing fixed).

export const PRICES: Record<DesignItem, number> = {
  solarMasts: 40,
  batteries: 50,
  greenhouse: 60,
  processor: 50,
  shield: 40,
  reserveO2: 15,
  reserveWater: 15,
  reserveFood: 15,
};

export const LIMITS: Record<DesignItem, number> = {
  solarMasts: 3,
  batteries: 3,
  greenhouse: 2,
  processor: 1,
  shield: 3,
  reserveO2: 5,
  reserveWater: 5,
  reserveFood: 5,
};

/**
 * Mission-only rules. Free mode keeps its own numbers (game/config.ts); these adapt them to
 * a 10-minute mission. Balance notes: with an empty design the crew survives only by
 * shedding lights and heating in the dark; storage, power and shelter each change that.
 */
export const MISSION_RULES = {
  /** Battery charge at the start, as a fraction of capacity (capacity is not charge). */
  initialEnergy: 0.6,
  /** O2, water and food at the start, as a fraction of capacity. */
  initialReserve: 0.5,
  /** Each reserve pack adds this fraction of capacity (capped at 100 %). */
  reservePerPack: 0.1,
  /** Crew use in the mission, as a multiple of free-mode use. */
  crewRate: { o2: 1, water: 0.8, food: 2.5 },
  /** Crew health lost per second while life support has no power (free mode: 0.3). */
  unpoweredHealthLoss: 1.5,
  /** Each greenhouse level adds the full grow-light draw again: a bigger farm costs power. */
  lightsDrawPerLevel: 1,
  /** Storm exposure outside any protection, in didactic units per second at strength 1. */
  stormRate: 0.8,
  /** Regolith already in the processor's hopper when it is bought. */
  initialRegolith: 40,
  /** Materials on hand (only used to replant a dead plant). */
  initialMaterials: 30,
  /** Grow lights at the start (0-100). */
  initialLights: 50,
};

export const SCENARIO_1: Scenario = {
  id: 'mision-1',
  seed: 1,
  duration: 600,
  budget: 300,
  exposureLimit: 40,
  depletionGrace: 20,
  events: [
    { kind: 'darkness', warnAt: 180, startAt: 240, endAt: 420 },
    {
      kind: 'storm', warnAt: 450, startAt: 480, endAt: 540, strength: 1,
      inspiredBy: { id: '2026-10-08T15:29:00-FLR-001', class: 'M6.7', peak: '2026-10-08T15:48Z', link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/49015/-1' },
    },
  ],
};
