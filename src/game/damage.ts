import { DAMAGE } from './config';
import type { GameState } from './state';

// Micrometeoroid damage. Tiny grains hit the Moon at tens of kilometers per second; with no
// atmosphere to burn them up, they puncture and pit equipment. Impacts land on random
// buildings, lower their performance, and the astronaut repairs them with materials.

/** Every built structure that can be hit, by key ('processor', 'solarMast:1', ...). */
export function builtKeys(s: GameState): string[] {
  const keys: string[] = [];
  if (s.levels.antenna) keys.push('antenna');
  if (s.levels.station) keys.push('station');
  if (s.levels.greenhouse) keys.push('greenhouse');
  if (s.levels.processor) keys.push('processor');
  for (let i = 0; i < s.counts.solarMast; i++) keys.push(`solarMast:${i}`);
  for (let i = 0; i < s.counts.battery; i++) keys.push(`battery:${i}`);
  return keys;
}

export function damageOf(s: GameState, key: string): number {
  return s.damage[key] ?? 0;
}

/** Chance of an impact during `dt` seconds; `shower` is the active shower strength 0-1. */
export function impactChance(dt: number, shower: number): number {
  return 1 - Math.exp((-dt * (1 + DAMAGE.showerBoost * shower)) / DAMAGE.meanInterval);
}

/** Hit a random built structure. Returns its key, or null when nothing is built yet. */
export function impact(s: GameState, rand: () => number = Math.random): string | null {
  const keys = builtKeys(s);
  if (!keys.length) return null;
  const key = keys[Math.floor(rand() * keys.length)];
  const hit = DAMAGE.hitMin + rand() * (DAMAGE.hitMax - DAMAGE.hitMin);
  s.damage[key] = Math.min(1, damageOf(s, key) + hit);
  return key;
}

export function repairCost(s: GameState, key: string): number {
  const d = damageOf(s, key);
  return d <= 0 ? 0 : Math.ceil(DAMAGE.repairBase + DAMAGE.repairPerDamage * d);
}

/** Repair a structure with materials. Returns false if it isn't damaged or can't be paid. */
export function repair(s: GameState, key: string): boolean {
  const cost = repairCost(s, key);
  if (cost === 0 || s.res.materials < cost) return false;
  s.res.materials -= cost;
  delete s.damage[key];
  return true;
}

// ---- Effects used by the simulation -------------------------------------------------------

/** Total solar output factor: sum over masts of their health (1 = like one undamaged mast). */
export function solarMastsOutput(s: GameState): number {
  let total = 0;
  for (let i = 0; i < s.counts.solarMast; i++) total += 1 - DAMAGE.solarLoss * damageOf(s, `solarMast:${i}`);
  return total;
}

export function batteriesCapacity(s: GameState): number {
  let total = 0;
  for (let i = 0; i < s.counts.battery; i++) total += 1 - DAMAGE.batteryLoss * damageOf(s, `battery:${i}`);
  return total;
}

export function processorFactor(s: GameState): number {
  return 1 - DAMAGE.processorLoss * damageOf(s, 'processor');
}
