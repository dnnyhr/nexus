import { COSTS, MAX_LEVEL, type BuildingKind } from './config';
import type { GameState } from './state';

// Building and upgrading. Most buildings have levels (station, greenhouse, processor,
// robots, shielding); solar masts and batteries are built as more units instead.

const REPEATABLE = new Set<BuildingKind>(['solarMast', 'battery']);

export function currentLevel(s: GameState, kind: BuildingKind): number {
  if (kind === 'solarMast' || kind === 'battery') return s.counts[kind];
  return s.levels[kind];
}

/** Materials needed for the next level or unit, or null when it is already at the maximum. */
export function nextCost(s: GameState, kind: BuildingKind): number | null {
  const level = currentLevel(s, kind);
  if (level >= MAX_LEVEL[kind]) return null;
  return REPEATABLE.has(kind) ? COSTS[kind][0] : COSTS[kind][level] ?? null;
}

export type BuildCheck = { ok: true; cost: number } | { ok: false; reason: 'max' | 'materials' | 'requires'; cost?: number; requires?: BuildingKind };

/** Why a building can or cannot be built right now (for the UI to explain it). */
export function checkBuild(s: GameState, kind: BuildingKind): BuildCheck {
  const cost = nextCost(s, kind);
  if (cost === null) return { ok: false, reason: 'max' };
  // A harvester needs a greenhouse; robots beyond level 1 need a bigger station to manage them.
  if (kind === 'harvesterRobot' && s.levels.greenhouse < 1) return { ok: false, reason: 'requires', requires: 'greenhouse' };
  if (kind === 'collectorRobot' && s.levels.collectorRobot >= s.levels.station) return { ok: false, reason: 'requires', requires: 'station' };
  if (s.res.materials < cost) return { ok: false, reason: 'materials', cost };
  return { ok: true, cost };
}

/** Build or upgrade. Returns false (and changes nothing) when it is not possible. */
export function build(s: GameState, kind: BuildingKind): boolean {
  const check = checkBuild(s, kind);
  if (!check.ok) return false;
  s.res.materials -= check.cost;
  if (kind === 'solarMast' || kind === 'battery') s.counts[kind] += 1;
  else s.levels[kind] += 1;
  return true;
}
