import snapshot from '../data/snapshot.json';
import type { DesignItem, Scenario } from './types';

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

export const PRICES: Record<DesignItem, number> = {
  solarMasts: 40, batteries: 50, greenhouse: 60, processor: 50, shield: 40,
  reserveO2: 15, reserveWater: 15, reserveFood: 15,
};
export const LIMITS: Record<DesignItem, number> = {
  solarMasts: 3, batteries: 3, greenhouse: 2, processor: 1, shield: 3,
  reserveO2: 5, reserveWater: 5, reserveFood: 5,
};
export const MISSION_RULES = {
  initialReserve: 0.5,
  reservePerPack: 0.1,
  initialEnergy: 0.5,
  initialGrowLights: 50,
  reducedLightsBelow: 50,
  agriculturalDrawPerLevel: 1,
  outsideExposurePerSecond: 0.8,
  unpoweredHealthLoss: 0.3,
};
