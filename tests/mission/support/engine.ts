import { expect } from 'vitest';
import type {
  Command,
  CommandResult,
  Design,
  DesignCheck,
  DesignItem,
  Horizon,
  LoggedCommand,
  MissionEvent,
  MissionState,
  Projection,
  Sample,
  Scenario,
  ScenarioEvent,
  Summary,
} from '../../../src/engine/types';

const ENGINE_KEY = '../../../src/engine/index.ts';
const engineModules = import.meta.glob('../../../src/engine/index.ts');

export const engineAvailable = Object.prototype.hasOwnProperty.call(engineModules, ENGINE_KEY);

export interface MissionEngine {
  STEP: number;
  SAMPLE_EVERY: number;
  SCENARIO_1: Scenario;
  PRICES: Record<DesignItem, number>;
  LIMITS: Record<DesignItem, number>;
  emptyDesign(): Design;
  checkDesign(design: Design, scenario?: Scenario): DesignCheck;
  startMission(design: Design, scenario?: Scenario): MissionState;
  applyCommand(mission: MissionState, command: Command): CommandResult;
  worldStep(mission: MissionState): void;
  project(mission: MissionState, plan: Command[], horizon: Horizon): Projection;
  replay(design: Design, log: LoggedCommand[], until: number, scenario?: Scenario): MissionState;
  darknessAt(mission: MissionState): { isDark: boolean; secondsLeft: number };
  nextEvent(mission: MissionState): ScenarioEvent | null;
  summarize(mission: MissionState): Summary;
}

export async function loadEngine(): Promise<MissionEngine> {
  const loader = engineModules[ENGINE_KEY];
  if (!loader) {
    throw new Error(
      'src/engine/index.ts no existe. La suite de misión está preparada pero el motor (carril A) aún no está integrado.',
    );
  }
  return (await loader()) as MissionEngine;
}

export const EPS = 1e-9;

export type Policy = (mission: MissionState, engine: MissionEngine) => void;

export interface ScheduledCommand {
  t: number;
  cmd: Command;
}

export interface RunOptions {
  stepsPerFrame?: number;
  speed?: 1 | 2;
  until?: number;
  policy?: Policy;
  policyEvery?: number;
  scheduled?: ScheduledCommand[];
  onFrame?: (mission: MissionState, engine: MissionEngine) => void;
}

export function runMission(engine: MissionEngine, design: Design, options: RunOptions = {}): MissionState {
  const mission = engine.startMission(design);
  const stepsPerFrame = options.stepsPerFrame ?? 1;
  const speed = options.speed ?? 1;
  const until = options.until ?? mission.scenario.duration;
  const policyEvery = options.policyEvery ?? 5;
  const scheduled = [...(options.scheduled ?? [])].sort((a, b) => a.t - b.t);
  let nextPolicyAt = 0;
  let nextScheduled = 0;
  let stepsInFrame = 0;

  while (mission.phase === 'running' && mission.t < until - EPS) {
    while (nextScheduled < scheduled.length && scheduled[nextScheduled].t <= mission.t + EPS) {
      engine.applyCommand(mission, scheduled[nextScheduled].cmd);
      nextScheduled++;
    }
    if (options.policy && mission.t + EPS >= nextPolicyAt) {
      options.policy(mission, engine);
      nextPolicyAt += policyEvery;
    }
    engine.worldStep(mission);
    stepsInFrame++;
    if (stepsInFrame >= stepsPerFrame * speed) {
      stepsInFrame = 0;
      options.onFrame?.(mission, engine);
    }
  }
  return mission;
}

export function designFor(engine: MissionEngine, patch: Partial<Design> & { reserves?: Partial<Design['reserves']> }): Design {
  const design = engine.emptyDesign();
  design.reserves = { ...design.reserves, ...(patch.reserves ?? {}) };
  for (const key of ['solarMasts', 'batteries', 'greenhouse', 'processor', 'shield'] as const) {
    if (patch[key] !== undefined) design[key] = patch[key] as number;
  }
  return design;
}

export const DESIGNS = {
  a: (engine: MissionEngine) =>
    designFor(engine, { greenhouse: 2, solarMasts: 1, shield: 1, reserves: { o2: 2, water: 2 } }),
  b: (engine: MissionEngine) => designFor(engine, { batteries: 3, shield: 2, solarMasts: 1 }),
  c: (engine: MissionEngine) => designFor(engine, { greenhouse: 2, solarMasts: 3 }),
};

const command = (mission: MissionState, engine: MissionEngine, cmd: Command) => {
  const result = engine.applyCommand(mission, cmd);
  return result;
};

export interface FarmPolicyOptions {
  lights: number;
  reduceLightsInDarkness: boolean;
  shelterFromStorm: boolean;
  irrigateBelow?: number;
  harvestAt?: number;
}

/**
 * Política reproducible basada solo en estado de misión y tiempo de simulación.
 * No usa reloj de pared, azar ni intervenciones ocultas.
 */
export function farmPolicy(options: FarmPolicyOptions): Policy {
  let lights = -1;
  let sheltered = false;
  let lastIrrigation = -100;
  let lastClimate = -100;
  let lastHarvest = -100;
  let lastReplant = -100;

  return (mission, engine) => {
    const t = mission.t;
    const plant = mission.game.plant;
    const targetLights = options.reduceLightsInDarkness
      ? t >= 240 && t < 420
        ? Math.min(options.lights, 40)
        : options.lights
      : options.lights;

    if (targetLights !== lights) {
      command(mission, engine, { type: 'setGrowLights', value: targetLights });
      lights = targetLights;
    }

    if (options.shelterFromStorm) {
      const shouldShelter = t >= 480 && t < 545;
      if (shouldShelter && !sheltered) {
        command(mission, engine, { type: 'enterShelter' });
        sheltered = true;
      } else if (!shouldShelter && sheltered) {
        command(mission, engine, { type: 'leaveShelter' });
        sheltered = false;
      }
    }

    if (plant.dead && t - lastReplant >= 30) {
      command(mission, engine, { type: 'replant' });
      lastReplant = t;
    }

    if (plant.water < (options.irrigateBelow ?? 38) && t - lastIrrigation >= 10) {
      command(mission, engine, { type: 'irrigate' });
      lastIrrigation = t;
    }

    if (t - lastClimate >= 10) {
      if (plant.temp < 42) {
        command(mission, engine, { type: 'adjustClimate', dir: 1 });
        lastClimate = t;
      } else if (plant.temp > 58) {
        command(mission, engine, { type: 'adjustClimate', dir: -1 });
        lastClimate = t;
      }
    }

    if (plant.growth >= (options.harvestAt ?? 99) && t - lastHarvest >= 10) {
      command(mission, engine, { type: 'harvest' });
      lastHarvest = t;
    }
  };
}

export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function expectSameState(actual: MissionState, expected: MissionState, message: string): void {
  expect(canonical(actual), message).toEqual(canonical(expected));
}

export interface NonSerializable {
  path: string;
  kind: 'nan' | 'infinity' | 'function' | 'symbol' | 'bigint' | 'circular';
}

export function findNonSerializable(value: unknown, root = '$'): NonSerializable[] {
  const found: NonSerializable[] = [];
  const seen = new WeakSet<object>();

  const walk = (node: unknown, path: string) => {
    if (typeof node === 'number') {
      if (Number.isNaN(node)) found.push({ path, kind: 'nan' });
      else if (!Number.isFinite(node)) found.push({ path, kind: 'infinity' });
      return;
    }
    if (typeof node === 'function') {
      found.push({ path, kind: 'function' });
      return;
    }
    if (typeof node === 'symbol') {
      found.push({ path, kind: 'symbol' });
      return;
    }
    if (typeof node === 'bigint') {
      found.push({ path, kind: 'bigint' });
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) {
      found.push({ path, kind: 'circular' });
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      walk(item, `${path}.${key}`);
    }
  };

  walk(value, root);
  return found;
}

export function expectFiniteSamples(samples: Sample[]): void {
  for (const [index, sample] of samples.entries()) {
    const where = `samples[${index}] (t=${sample.t})`;
    for (const key of ['t', 'o2', 'water', 'food', 'energy', 'exposure', 'crewHealth', 'lights', 'plantGrowth'] as const) {
      expect(Number.isFinite(sample[key]), `${where}.${key} no es finito`).toBe(true);
    }
    for (const key of ['o2', 'water', 'food', 'energy', 'crewHealth', 'lights', 'plantGrowth'] as const) {
      expect(sample[key], `${where}.${key} fuera de 0-100`).toBeGreaterThanOrEqual(0);
      expect(sample[key], `${where}.${key} fuera de 0-100`).toBeLessThanOrEqual(100);
    }
    expect(sample.exposure, `${where}.exposure negativa`).toBeGreaterThanOrEqual(0);
    expect(typeof sample.sheltered, `${where}.sheltered`).toBe('boolean');
    expect(typeof sample.isDark, `${where}.isDark`).toBe('boolean');
  }
}

export function expectOrderedEvents(events: MissionEvent[]): void {
  for (let i = 1; i < events.length; i++) {
    expect(events[i].t, `evento ${i} retrocede en el tiempo`).toBeGreaterThanOrEqual(events[i - 1].t);
  }
  const seen = new Set<string>();
  for (const event of events) {
    const key = `${event.t}:${event.kind}`;
    expect(seen.has(key), `evento duplicado ${key}`).toBe(false);
    seen.add(key);
  }
}

export function expectOrderedLog(log: LoggedCommand[]): void {
  for (let i = 1; i < log.length; i++) {
    expect(log[i].t, `comando ${i} retrocede en el tiempo`).toBeGreaterThanOrEqual(log[i - 1].t);
  }
  for (const [index, entry] of log.entries()) {
    expect(typeof entry.ok, `log[${index}].ok`).toBe('boolean');
    expect(entry.cmd && typeof entry.cmd.type, `log[${index}].cmd.type`).toBe('string');
  }
}

export function countKind(events: MissionEvent[], kind: MissionEvent['kind']): number {
  return events.filter((event) => event.kind === kind).length;
}

export function expectAt(actual: number, expected: number, message: string, tolerance = 1e-6): void {
  expect(Math.abs(actual - expected), `${message}: esperado ${expected}, observado ${actual}`).toBeLessThanOrEqual(tolerance);
}
