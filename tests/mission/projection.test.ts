import { beforeAll, describe, expect, it } from 'vitest';
import type { Command, CommandResult, MissionState, Projection } from '../../src/engine/types';
import {
  DESIGNS,
  EPS,
  canonical,
  engineAvailable,
  expectSameState,
  farmPolicy,
  jsonClone,
  loadEngine,
  runMission,
  type MissionEngine,
} from './support/engine';

const suite = engineAvailable ? describe : describe.skip;
const makePolicy = () => farmPolicy({ lights: 55, reduceLightsInDarkness: true, shelterFromStorm: true });

interface ExecutedPlan {
  mission: MissionState;
  rejected: { cmd: Command; reason: string }[];
}

function executePlan(
  engine: MissionEngine,
  source: MissionState,
  plan: Command[],
  until: number,
): ExecutedPlan {
  const mission = jsonClone(source);
  const rejected: { cmd: Command; reason: string }[] = [];
  for (const cmd of plan) {
    const result: CommandResult = engine.applyCommand(mission, cmd);
    if (!result.ok) rejected.push({ cmd, reason: result.reason ?? '' });
  }
  while (mission.phase === 'running' && mission.t < until - EPS) {
    engine.worldStep(mission);
  }
  return { mission, rejected };
}

suite('proyección y paridad con ejecución (motor real)', () => {
  let engine: MissionEngine;
  let source: MissionState;
  const plan: Command[] = [
    { type: 'setGrowLights', value: 150 },
    { type: 'setGrowLights', value: 50 },
    { type: 'irrigate' },
  ];

  beforeAll(async () => {
    engine = await loadEngine();
    source = runMission(engine, DESIGNS.a(engine), { until: 100, policy: makePolicy() });
  });

  it('project no muta el estado de origen', () => {
    const before = canonical(source);
    engine.project(source, plan, { kind: 'seconds', value: 120 });
    expect(canonical(source)).toEqual(before);
  });

  it('la proyección de 120 s coincide con ejecutar el mismo plan con worldStep', () => {
    const projection: Projection = engine.project(source, plan, { kind: 'seconds', value: 120 });
    const executed = executePlan(engine, source, plan, projection.until);

    expect(projection.until).toBeCloseTo(220, 9);
    expect(projection.phase).toBe(executed.mission.phase);
    expect(projection.failure).toEqual(executed.mission.failure);
    expect(projection.rejected).toEqual(executed.rejected);

    expect(projection.samples.length).toBeGreaterThan(1);
    expect(projection.samples[0].t).toBeCloseTo(source.t, 9);
    const executedSamples = executed.mission.samples.filter((sample) => sample.t > source.t + EPS);
    expect(canonical(projection.samples.slice(1))).toEqual(canonical(executedSamples));

    const futureEvents = executed.mission.events.filter((event) => event.t > source.t + EPS);
    expect(projection.events.every((event) => event.t > source.t + EPS)).toBe(true);
    expect(canonical(projection.events)).toEqual(canonical(futureEvents));
  });

  it('endOfDarkness y endOfMission respetan el horizonte o el fallo', () => {
    const dark = engine.project(source, [], { kind: 'endOfDarkness' });
    expect(dark.until).toBe(420);
    const end = engine.project(source, [], { kind: 'endOfMission' });
    expect(end.until).toBeLessThanOrEqual(600);
    if (end.phase === 'failed') {
      expect(end.failure).not.toBeNull();
      expect(end.until).toBeCloseTo(end.failure!.t, 9);
    } else {
      expect(end.until).toBe(600);
    }
  });

  it('un plan rechazado informa el motivo y no duplica comandos previos', () => {
    const projection = engine.project(source, plan, { kind: 'seconds', value: 30 });
    expect(projection.rejected.length).toBe(1);
    expect(projection.rejected[0].cmd).toEqual({ type: 'setGrowLights', value: 150 });
    expect(projection.rejected[0].reason.length).toBeGreaterThan(0);
    expect(projection.samples[0].t).toBeCloseTo(100, 9);
  });

  it('proyectar desde el inicio no promete acciones futuras ni altera el original', () => {
    const start = engine.startMission(DESIGNS.b(engine));
    const before = canonical(start);
    const projection = engine.project(start, [], { kind: 'seconds', value: 60 });
    expect(canonical(start)).toEqual(before);
    expect(projection.samples[0].t).toBe(0);
    expect(projection.until).toBe(60);
    expect(projection.samples.every((sample) => sample.t >= 0 && sample.t <= 60 + EPS)).toBe(true);
  });

  it('el estado proyectado no filtra NaN ni Infinity', () => {
    const projection = engine.project(source, plan, { kind: 'endOfMission' });
    const replayed = engine.replay(source.design, source.log, source.t);
    expectSameState(replayed, source, 'replay previo a la proyección');
    for (const sample of projection.samples) {
      for (const value of Object.values(sample)) {
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
