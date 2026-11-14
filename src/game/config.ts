// Every tunable number of the simulation lives here, so balancing the game never means
// hunting through logic. Units: resources are abstract units, time is in game seconds.
// Values are first guesses for the demo and are meant to be adjusted while play-testing.

export const CYCLE = {
  /** One full lunar day + night in real seconds (10 + 10 min). Real: ~29.5 Earth days. */
  daySeconds: 600,
  nightSeconds: 600,
};

export const STORAGE = {
  /** Base capacity of O2, water and food, raised by station levels. */
  lifeBase: 100,
  lifePerStationLevel: 40,
  materialsBase: 200,
  regolithBase: 150,
  /** Battery capacity: the station has a small one, each battery adds more. */
  energyBase: 120,
  energyPerBattery: 300,
};

export const CREW = {
  o2PerSecond: 0.07,
  waterPerSecond: 0.045,
  foodPerSecond: 0.035,
  /** Health lost per second for each empty life resource. */
  healthLossPerEmpty: 0.5,
  healthRecovery: 0.1,
};

export const ENERGY = {
  /** The lander's own small solar panels keep the first systems alive. */
  landerSolar: 1.2,
  solarPerMast: 2.4,
  lifeSupportDraw: 0.6,
  heatingDraw: 0.5,
  processorDraw: 1.2,
  robotDraw: 0.25,
  /** Grow lights draw scales with their brightness (0-100). */
  growLightsMaxDraw: 0.9,
};

export const PROCESSOR = {
  regolithPerSecond: 0.5,
  /** More than 40 % of regolith by mass is oxygen bound in minerals. */
  o2PerRegolith: 0.42,
  materialsPerRegolith: 0.55,
};

export const COLLECT = {
  regolithPerTap: 4,
  /** Regolith bag by level (1-3): what it holds and what each dig puts in it. */
  bagCapacity: [12, 20, 32],
  digPerLevel: [4, 5, 6],
  /** Base bag size (level 1), kept for older code and tests. */
  carryMax: 12,
  robotPerSecond: 0.45,
};

export const GREENHOUSE = {
  optimalMin: 40,
  optimalMax: 60,
  waterDrift: -0.35,
  tempDayDrift: 0.18,
  tempNightDrift: -0.3,
  /** Stress gained per second per parameter out of range; lost per second when all are fine. */
  stressPerBadParam: 1.6,
  stressRecovery: 1.2,
  growthPerSecond: 0.55,
  /** Plant stops growing above this stress; dies after `deathSeconds` at max stress. */
  stressNoGrowth: 60,
  deathSeconds: 30,
  foodPerHarvestPerLevel: 14,
  waterPerIrrigation: 2,
  irrigationAmount: 22,
  climateStep: 12,
  climateEnergy: 3,
  replantMaterials: 8,
  /** Offline, parameters drift at a quarter of their speed and plants never die. */
  offlineFactor: 0.25,
};

export const SHIELD = {
  base: 25,
  perBermLevel: 22,
  shelterBonus: 45,
};

/** Micrometeoroid damage. Damage per building goes from 0 (fine) to 1 (badly hit). */
export const DAMAGE = {
  /** Mean seconds between impacts on the base on a quiet day; showers make them more frequent. */
  meanInterval: 240,
  showerBoost: 4,
  hitMin: 0.35,
  hitMax: 0.6,
  /** How much a fully damaged building loses: solar output, processing speed, battery size. */
  solarLoss: 0.7,
  processorLoss: 0.7,
  batteryLoss: 0.5,
  /** A punctured greenhouse loses water faster; a punctured habitat leaks oxygen. */
  greenhouseLeak: 2,
  stationO2Leak: 0.06,
  repairBase: 6,
  repairPerDamage: 18,
};

/** Solar storms (solar energetic particle events), each recreating a real recent flare. */
export const STORM = {
  /** Mean seconds between storms once they are enabled (first one comes sooner). */
  meanInterval: 420,
  firstDelay: 40,
  /** Warning time before particles arrive: stronger flares give less time. */
  warnMax: 35,
  warnMin: 20,
  durationMin: 30,
  durationMax: 70,
  /** Dose rate outside, in mSv per second of play, for a weak and a very strong storm. */
  doseMin: 0.4,
  doseMax: 4,
  /** The suit alone stops very little; the lander hull a good part; the habitat most. */
  suitProtection: 0.1,
  landerProtection: 0.6,
  /** Crew health lost per mSv received. */
  healthPerMsv: 0.35,
};

export const OFFLINE = {
  maxSeconds: 8 * 3600,
};

export type BuildingKind = 'bag' | 'antenna' | 'station' | 'greenhouse' | 'processor' | 'solarMast' | 'battery' | 'collectorRobot' | 'harvesterRobot' | 'shield';

/** Material cost to build (level 1) or to upgrade to each next level. */
/**
 * Material cost of each step: index = current level (0 means "build it"). Solar masts and
 * batteries are repeatable, so they always cost their first value.
 */
export const COSTS: Record<BuildingKind, number[]> = {
  bag: [0, 40, 90],
  antenna: [30],
  station: [50, 120, 220, 360, 520],
  greenhouse: [50, 90, 180, 300, 450],
  processor: [40, 80, 160],
  solarMast: [45],
  battery: [60],
  collectorRobot: [60, 110, 180],
  harvesterRobot: [90],
  shield: [40, 70, 110],
};

/** Maximum level for upgradable buildings, or maximum count for repeatable ones. */
export const MAX_LEVEL: Record<BuildingKind, number> = {
  bag: 3,
  antenna: 1,
  station: 5,
  greenhouse: 5,
  processor: 3,
  solarMast: 6,
  battery: 4,
  collectorRobot: 3,
  harvesterRobot: 1,
  shield: 3,
};
