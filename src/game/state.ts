import { CYCLE } from './config';

// The whole game state is one plain, serializable object: easy to save, load and test.

export interface Resources {
  o2: number;
  water: number;
  food: number;
  energy: number;
  regolith: number;
  materials: number;
}

export interface PowerSettings {
  /** Heating keeps the crew and plants warm at night. */
  heating: boolean;
  processor: boolean;
  robots: boolean;
  /** Grow-light brightness 0-100: more light, more energy. */
  growLights: number;
}

export interface Plant {
  water: number;
  light: number;
  temp: number;
  /** 0-100 % */
  growth: number;
  /** 0-100 */
  stress: number;
  /** Seconds spent at max stress. */
  maxStressTime: number;
  dead: boolean;
}

export interface GameState {
  version: 1;
  /** Seconds of play since the start (never resets). */
  time: number;
  /** Real timestamp of the last save, for offline progress. */
  savedAt: number;
  res: Resources;
  levels: {
    antenna: number;
    station: number;
    greenhouse: number;
    processor: number;
    collectorRobot: number;
    harvesterRobot: number;
    /** Regolith berm level 0-3. */
    shield: number;
  };
  counts: {
    solarMast: number;
    battery: number;
  };
  power: PowerSettings;
  plant: Plant;
  crewHealth: number;
  sheltered: boolean;
  /** Accumulated radiation dose of the mission (mSv). */
  dose: number;
  stats: {
    harvests: number;
    regolithCollected: number;
    materialsMade: number;
  };
  /** Index of the current mission (see missions.ts). */
  mission: number;
}

export function newGame(now = Date.now()): GameState {
  return {
    version: 1,
    time: 0,
    savedAt: now,
    // The astronaut starts with only the lander: some supplies and a few materials.
    res: { o2: 90, water: 90, food: 80, energy: 100, regolith: 0, materials: 60 },
    levels: { antenna: 0, station: 0, greenhouse: 0, processor: 0, collectorRobot: 0, harvesterRobot: 0, shield: 0 },
    counts: { solarMast: 0, battery: 0 },
    power: { heating: true, processor: true, robots: true, growLights: 60 },
    plant: { water: 50, light: 50, temp: 50, growth: 0, stress: 0, maxStressTime: 0, dead: false },
    crewHealth: 100,
    sheltered: false,
    dose: 0,
    stats: { harvests: 0, regolithCollected: 0, materialsMade: 0 },
    mission: 0,
  };
}

/** Position in the lunar cycle. */
export function cyclePhase(time: number): { isDay: boolean; progress: number; secondsLeft: number; cycle: number } {
  const total = CYCLE.daySeconds + CYCLE.nightSeconds;
  const t = time % total;
  const isDay = t < CYCLE.daySeconds;
  const span = isDay ? CYCLE.daySeconds : CYCLE.nightSeconds;
  const into = isDay ? t : t - CYCLE.daySeconds;
  return { isDay, progress: into / span, secondsLeft: span - into, cycle: Math.floor(time / total) };
}
