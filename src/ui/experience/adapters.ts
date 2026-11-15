import { ENERGY } from '../../game/config';
import { priorityOf } from '../../game/power';
import { capacity, type PowerReport } from '../../game/sim';
import { cyclePhase, type GameState } from '../../game/state';
import type { SystemsSnapshot } from './systems';
import type { TelemetrySnapshot } from './telemetry';

function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function telemetryFromGame(
  game: GameState,
  power: PowerReport,
  now = Date.now(),
  patch: Partial<TelemetrySnapshot> = {},
): TelemetrySnapshot {
  const cap = capacity(game);
  const phase = cyclePhase(game.time);
  return {
    updatedAt: now,
    o2: percent(game.res.o2, cap.o2),
    water: percent(game.res.water, cap.water),
    food: percent(game.res.food, cap.food),
    energy: percent(game.res.energy, cap.energy),
    generation: power.generation,
    demand: power.demand,
    dark: !phase.isDay,
    sheltered: game.sheltered,
    storm: game.storm.phase !== 'none',
    ...patch,
  };
}

export function systemsFromGame(
  game: GameState,
  power: PowerReport,
  patch: Partial<SystemsSnapshot> = {},
): SystemsSnapshot {
  const cap = capacity(game);
  const phase = cyclePhase(game.time);
  const lightsDraw = (power.running.lights / 100) * ENERGY.growLightsMaxDraw * Math.min(1, game.levels.greenhouse);
  return {
    energy: percent(game.res.energy, cap.energy),
    generation: power.generation,
    demand: power.demand,
    lights: game.power.growLights,
    breakers: {
      heating: game.power.heating,
      processor: game.power.processor,
      robots: game.power.robots,
      greenhouse: game.power.greenhouse,
    },
    priority: priorityOf(game),
    shed: power.shed ?? [],
    dark: !phase.isDay,
    sheltered: game.sheltered,
    shortage: power.shortage,
    lightsDraw,
    ...patch,
  };
}
