import { COLLECT, ENERGY, OFFLINE, PROCESSOR } from './config';
import { processorFactor, solarMastsOutput } from './damage';
import { capacity, harvest, stepGreenhouse } from './sim';
import { newGame, type GameState } from './state';

// Saving and offline progress. The game is saved on the device (no server, no account).
// When the player comes back, the time away (up to 8 hours) is simulated in a simplified
// way: robots, the processor and the solar masts keep working, plants drift at a quarter
// of their speed and never die, and emergencies (storms, impacts) are not simulated. Crew
// needs are paused too, so coming back never means finding the crew dead.

const KEY = 'nexus.save.v1';

/** Fill in fields missing from older saves with today's defaults (deep, for plain objects). */
function withDefaults<T>(defaults: T, saved: unknown): T {
  if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) {
    return (saved === undefined ? defaults : saved) as T;
  }
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  const src = (typeof saved === 'object' && saved !== null ? saved : {}) as Record<string, unknown>;
  for (const k of Object.keys(src)) {
    const d = (defaults as Record<string, unknown>)[k];
    out[k] = d !== undefined && typeof d === 'object' && d !== null && !Array.isArray(d) && Object.keys(d).length
      ? withDefaults(d, src[k])
      : src[k];
  }
  return out as T;
}

export function saveGame(s: GameState, now = Date.now()): boolean {
  s.savedAt = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false; // storage blocked or full: the game keeps running
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return withDefaults(newGame(), JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

export interface OfflineReport {
  seconds: number;
  regolith: number;
  materials: number;
  o2: number;
  harvests: number;
  plantStress: number;
  plantDead: boolean;
}

/** Simulate the time away (capped at 8 hours). Mutates the state and returns a summary. */
export function simulateOffline(s: GameState, elapsedSeconds: number): OfflineReport {
  const seconds = Math.max(0, Math.min(OFFLINE.maxSeconds, elapsedSeconds));
  const before = { regolith: s.res.regolith, materials: s.res.materials, o2: s.res.o2, harvests: s.stats.harvests };
  const cap = capacity(s);
  const step = 60;
  const run = { processor: s.power.processor, robots: s.power.robots, heating: s.power.heating, lights: (s.power.greenhouse ? s.power.growLights : 0) * 0.5 };
  for (let t = 0; t < seconds; t += step) {
    const dt = Math.min(step, seconds - t);
    if (s.power.robots && s.levels.collectorRobot > 0) {
      s.res.regolith = Math.min(cap.regolith, s.res.regolith + COLLECT.robotPerSecond * s.levels.collectorRobot * dt);
    }
    if (s.power.processor && s.levels.processor > 0 && s.res.regolith > 0) {
      const used = Math.min(s.res.regolith, PROCESSOR.regolithPerSecond * (1 + 0.5 * (s.levels.processor - 1)) * processorFactor(s) * dt);
      s.res.regolith -= used;
      s.res.o2 = Math.min(cap.o2, s.res.o2 + used * PROCESSOR.o2PerRegolith);
      s.res.materials = Math.min(cap.materials, s.res.materials + used * PROCESSOR.materialsPerRegolith);
      s.stats.materialsMade += used * PROCESSOR.materialsPerRegolith;
    }
    // Half the time is lunar night: on average the masts make half their output.
    s.res.energy = Math.min(cap.energy, s.res.energy + (ENERGY.landerSolar + solarMastsOutput(s) * ENERGY.solarPerMast) * 0.5 * dt * 0.2);
    stepGreenhouse(s, dt, (t / 600) % 2 < 1, run, true);
    if (s.plant.growth >= 100 && s.levels.harvesterRobot > 0) harvest(s);
  }
  s.time += seconds;
  return {
    seconds,
    regolith: Math.round(s.res.regolith - before.regolith),
    materials: Math.round(s.res.materials - before.materials),
    o2: Math.round(s.res.o2 - before.o2),
    harvests: s.stats.harvests - before.harvests,
    plantStress: Math.round(s.plant.stress),
    plantDead: s.plant.dead,
  };
}
