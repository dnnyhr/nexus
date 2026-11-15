import { CYCLE, POWER, type Circuit } from './config';

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
  /** Greenhouse breaker: open, the grow lights get no power whatever their brightness. */
  greenhouse: boolean;
  /** Grow-light brightness 0-100: more light, more energy. */
  growLights: number;
  /** Which circuit is fed first when power falls short (a permutation of POWER.circuits). */
  priority: Circuit[];
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
    /** Regolith bag level 1-3 (bigger bag, more per dig). */
    bag: number;
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
  /** Micrometeoroid damage per building key ('processor', 'solarMast:0', ...), 0-1. */
  damage: Record<string, number>;
  /** Emergency supply drops: seconds until another can be sent, and how many were sent. */
  rescue: { cooldown: number; count: number };
  /** Expedition rover: where it is parked, whether the astronaut drives it, ice on board. */
  rover: { x: number; z: number; rot: number; driving: boolean; ice: number };
  /** Where the astronaut stands (saved so a game resumes in place). */
  player: { x: number; z: number };
  /** Regolith in the astronaut's bag, not yet delivered to the processor. */
  carried: number;
  crewHealth: number;
  sheltered: boolean;
  /** Solar storm in progress, if any (see storm.ts). */
  storm: {
    phase: 'none' | 'warning' | 'active';
    timeLeft: number;
    /** Seconds until the next storm (counts only once storms are enabled). */
    nextIn: number;
    strength: number;
    flare: { id: string; class: string; peak: string; link: string } | null;
    /** How many recent real flares have been used, to cycle through them. */
    used: number;
    /** True when triggered by a live GOES reading at storm level. */
    live: boolean;
  };
  /** Accumulated radiation dose of the mission (mSv). */
  dose: number;
  stats: {
    harvests: number;
    regolithCollected: number;
    materialsMade: number;
    iceDelivered: number;
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
    levels: { bag: 1, antenna: 0, station: 0, greenhouse: 0, processor: 0, collectorRobot: 0, harvesterRobot: 0, shield: 0 },
    counts: { solarMast: 0, battery: 0 },
    power: { heating: true, processor: true, robots: true, greenhouse: true, growLights: 60, priority: [...POWER.defaultPriority] },
    plant: { water: 50, light: 50, temp: 50, growth: 0, stress: 0, maxStressTime: 0, dead: false },
    damage: {},
    rover: { x: 9, z: 4, rot: -0.6, driving: false, ice: 0 },
    rescue: { cooldown: 0, count: 0 },
    player: { x: -14.5, z: 9.5 },
    carried: 0,
    crewHealth: 100,
    sheltered: false,
    storm: { phase: 'none', timeLeft: 0, nextIn: 40, strength: 0, flare: null, used: 0, live: false },
    dose: 0,
    stats: { harvests: 0, regolithCollected: 0, materialsMade: 0, iceDelivered: 0 },
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
