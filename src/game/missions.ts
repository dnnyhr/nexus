import type { BuildingKind } from './config';
import type { GameState } from './state';

// The mission chain: one clear goal at a time. The lander's computer gives the very first
// one; after the comms antenna is built, missions arrive by radio from the commander at
// Mission Control on Earth. Completing a mission unlocks what can be built next and Earth
// sends a supply drop of materials, so the player is never stuck.

/** Where the mission points the player: a building slot, or an activity. */
export type MissionTarget = BuildingKind | 'dig' | 'greenhouseUse';

export interface Mission {
  id: string;
  from: 'lander' | 'radio';
  target: MissionTarget;
  /** What becomes buildable when this mission starts. */
  unlocks: BuildingKind[];
  /** Materials sent from Earth when the mission is completed. */
  reward: number;
  progress(s: GameState): { have: number; need: number };
}

const level = (kind: keyof GameState['levels']) => (s: GameState) => ({ have: Math.min(1, s.levels[kind]), need: 1 });
const count = (kind: keyof GameState['counts']) => (s: GameState) => ({ have: Math.min(1, s.counts[kind]), need: 1 });

export const MISSIONS: Mission[] = [
  { id: 'antenna', from: 'lander', target: 'antenna', unlocks: ['antenna'], reward: 20, progress: level('antenna') },
  { id: 'dig', from: 'radio', target: 'dig', unlocks: [], reward: 20, progress: (s) => ({ have: Math.min(12, Math.floor(s.stats.regolithCollected)), need: 12 }) },
  { id: 'processor', from: 'radio', target: 'processor', unlocks: ['processor'], reward: 10, progress: level('processor') },
  { id: 'materials', from: 'radio', target: 'dig', unlocks: [], reward: 20, progress: (s) => ({ have: Math.min(15, Math.floor(s.stats.materialsMade)), need: 15 }) },
  { id: 'solar', from: 'radio', target: 'solarMast', unlocks: ['solarMast'], reward: 20, progress: count('solarMast') },
  { id: 'habitat', from: 'radio', target: 'station', unlocks: ['station'], reward: 40, progress: level('station') },
  { id: 'robot', from: 'radio', target: 'collectorRobot', unlocks: ['collectorRobot'], reward: 20, progress: level('collectorRobot') },
  { id: 'greenhouse', from: 'radio', target: 'greenhouse', unlocks: ['greenhouse'], reward: 10, progress: level('greenhouse') },
  { id: 'harvest', from: 'radio', target: 'greenhouseUse', unlocks: [], reward: 25, progress: (s) => ({ have: Math.min(1, s.stats.harvests), need: 1 }) },
  { id: 'battery', from: 'radio', target: 'battery', unlocks: ['battery'], reward: 15, progress: count('battery') },
  { id: 'shield', from: 'radio', target: 'shield', unlocks: ['shield'], reward: 20, progress: level('shield') },
  { id: 'grow', from: 'radio', target: 'station', unlocks: ['harvesterRobot'], reward: 30, progress: (s) => ({ have: Math.min(2, s.levels.station), need: 2 }) },
  // Last: free play towards a stable colony (never auto-completes).
  { id: 'colony', from: 'radio', target: 'station', unlocks: [], reward: 0, progress: (s) => ({ have: Math.min(5, s.levels.station), need: 6 }) },
];

export function currentMission(s: GameState): Mission {
  return MISSIONS[Math.min(s.mission, MISSIONS.length - 1)];
}

/** Everything the player may build right now (unlocked by the current or earlier missions). */
export function unlocked(s: GameState): Set<BuildingKind> {
  const set = new Set<BuildingKind>();
  for (let i = 0; i <= Math.min(s.mission, MISSIONS.length - 1); i++) MISSIONS[i].unlocks.forEach((k) => set.add(k));
  return set;
}

/** Radio works only once the antenna is up; before that, the lander's computer talks. */
export function hasRadio(s: GameState): boolean {
  return s.levels.antenna > 0;
}

/**
 * If the current mission is done, give its reward and move to the next one.
 * Returns the completed mission (for the UI to celebrate), or null.
 */
export function advanceMission(s: GameState): Mission | null {
  const m = currentMission(s);
  if (s.mission >= MISSIONS.length - 1) return null;
  const p = m.progress(s);
  if (p.have < p.need) return null;
  s.res.materials += m.reward;
  s.mission += 1;
  return m;
}
