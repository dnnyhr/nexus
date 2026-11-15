import snapshot from '../data/snapshot.json';
import { MISSION } from '../game/config';
import type { Design, DesignItem, Scenario } from './types';

export const SCENARIO_SOURCE = {
  label: 'Escenario fijo inspirado en dato real',
  live: false,
  fetchedAt: snapshot.fetchedAt,
};

const flare = snapshot.flares.find(f => f.id === '2026-10-08T15:29:00-FLR-001');
if (!flare) throw new Error('Fulguración de referencia ausente del snapshot local');

export const SCENARIO_1: Scenario = {
  id: 'mision-1', seed: 1, duration: 600, budget: 300, exposureLimit: 40, depletionGrace: 20,
  events: [
    { kind: 'darkness', warnAt: 180, startAt: 240, endAt: 420 },
    { kind: 'storm', warnAt: 450, startAt: 480, endAt: 540, strength: 1, inspiredBy: { ...flare } },
  ],
};

export const PRICES: Record<DesignItem, number> = MISSION.prices;
export const LIMITS: Record<DesignItem, number> = MISSION.limits;
/** Balance de misión: vive en src/game/config.ts (MISSION) junto al resto del juego. */
export const MISSION_RULES = MISSION;

/**
 * Cadet training base: berm 1 and one O2 and one water reserve, no extra battery, so the
 * darkness is a real power crisis and a redesign with a battery shows a measurable difference.
 */
export const CADET_DESIGN: Design = {
  solarMasts: 0, batteries: 0, greenhouse: 0, processor: 0, shield: 1, reserves: { o2: 1, water: 1, food: 0 },
};
