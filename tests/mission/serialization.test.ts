import { beforeAll, describe, expect, it } from 'vitest';
import type { MissionState } from '../../src/engine/types';
import {
  DESIGNS,
  EPS,
  canonical,
  engineAvailable,
  expectSameState,
  farmPolicy,
  findNonSerializable,
  jsonClone,
  loadEngine,
  runMission,
  type MissionEngine,
} from './support/engine';

const suite = engineAvailable ? describe : describe.skip;
const makePolicy = () => farmPolicy({ lights: 55, reduceLightsInDarkness: true, shelterFromStorm: true });

suite('serialización y replay (motor real)', () => {
  let engine: MissionEngine;
  let mission: MissionState;

  beforeAll(async () => {
    engine = await loadEngine();
    mission = runMission(engine, DESIGNS.a(engine), { until: 300, policy: makePolicy() });
  });

  it('MissionState sobrevive JSON.stringify/parse sin cambios', () => {
    const text = JSON.stringify(mission);
    expect(text.includes('Infinity'), 'JSON contiene Infinity').toBe(false);
    expect(text.includes('NaN'), 'JSON contiene NaN').toBe(false);
    const parsed = JSON.parse(text) as MissionState;
    expect(canonical(parsed)).toEqual(canonical(mission));
  });

  it('no hay funciones, NaN, Infinity, símbolos, bigint ni ciclos en el estado', () => {
    expect(findNonSerializable(mission)).toEqual([]);
  });

  it('continuar desde la copia JSON da el mismo estado que continuar el original', () => {
    const original = jsonClone(mission);
    const copy = JSON.parse(JSON.stringify(mission)) as MissionState;
    for (let i = 0; i < 200; i++) {
      engine.worldStep(original);
      engine.worldStep(copy);
    }
    expectSameState(copy, original, 'la copia serializada divergió al continuar');
    expect(engine.summarize(copy)).toEqual(engine.summarize(original));
  });

  it('replay reproduce estado y resumen desde el log serializado', () => {
    const log = JSON.parse(JSON.stringify(mission.log));
    const replayed = engine.replay(mission.design, log, mission.t);
    expectAtTime(replayed.t, mission.t);
    expectSameState(replayed, mission, 'replay no reprodujo el estado económico');
    expect(engine.summarize(replayed)).toEqual(engine.summarize(mission));
  });

  it('replay conserva comandos rechazados y su efecto nulo', () => {
    const probe = runMission(engine, DESIGNS.a(engine), { until: 10, policy: makePolicy() });
    engine.applyCommand(probe, { type: 'setGrowLights', value: -5 });
    engine.applyCommand(probe, { type: 'setGrowLights', value: 55 });
    for (let i = 0; i < 400; i++) engine.worldStep(probe);
    const replayed = engine.replay(probe.design, jsonClone(probe.log), probe.t);
    expectSameState(replayed, probe, 'replay perdió comandos rechazados o su orden');
    expect(replayed.log.some((entry) => !entry.ok)).toBe(true);
  });

  it('replay conserva varios comandos en el mismo instante, aceptados y rechazados', () => {
    const probe = engine.startMission(DESIGNS.a(engine));
    engine.applyCommand(probe, { type: 'setGrowLights', value: 62 });
    engine.applyCommand(probe, { type: 'setGrowLights', value: 62 });
    engine.applyCommand(probe, { type: 'enterShelter' });
    engine.applyCommand(probe, { type: 'enterShelter' });
    engine.applyCommand(probe, { type: 'setGrowLights', value: 150 });
    for (let i = 0; i < 200; i++) engine.worldStep(probe);
    const replayed = engine.replay(probe.design, jsonClone(probe.log), probe.t);
    expectSameState(replayed, probe, 'replay no reprodujo comandos simultáneos');
    expect(probe.log.map((entry) => entry.ok)).toEqual([true, true, true, false, false]);
  });

  it('un comando rechazado no consume recursos ni cambia el juego', () => {
    const probe = runMission(engine, DESIGNS.a(engine), { until: 30, policy: makePolicy() });
    const commands: { type: 'setGrowLights'; value: number }[] = [
      { type: 'setGrowLights', value: 101 },
      { type: 'setGrowLights', value: -1 },
      { type: 'setGrowLights', value: Number.NaN },
      { type: 'setGrowLights', value: Number.POSITIVE_INFINITY },
    ];
    for (const cmd of commands) {
      const before = jsonClone(probe);
      const result = engine.applyCommand(probe, cmd);
      expect(result.ok, `setGrowLights(${cmd.value}) debió rechazarse`).toBe(false);
      const after = jsonClone(probe);
      before.log = after.log;
      expect(after.game, `el rechazo de setGrowLights(${cmd.value}) alteró el juego`).toEqual(before.game);
      expect(after.metrics).toEqual(before.metrics);
      expect(after.exposure).toBeCloseTo(before.exposure, 12);
    }
  });

});

function expectAtTime(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(EPS);
}
