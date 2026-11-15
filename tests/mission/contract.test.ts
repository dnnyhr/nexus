import { beforeAll, describe, expect, it } from 'vitest';
import type { MissionState, Sample } from '../../src/engine/types';
import {
  DESIGNS,
  EPS,
  countKind,
  engineAvailable,
  expectAt,
  expectFiniteSamples,
  expectOrderedEvents,
  expectOrderedLog,
  farmPolicy,
  findNonSerializable,
  jsonClone,
  loadEngine,
  runMission,
  type MissionEngine,
} from './support/engine';

const suite = engineAvailable ? describe : describe.skip;

const makePolicy = () => farmPolicy({ lights: 55, reduceLightsInDarkness: true, shelterFromStorm: true });

suite('contrato de datos de Misión 1 (motor real)', () => {
  let engine: MissionEngine;
  let mission: MissionState;

  beforeAll(async () => {
    engine = await loadEngine();
    mission = runMission(engine, DESIGNS.a(engine), { policy: makePolicy() });
  });

  it('la referencia A completa 600 s sin fallar', () => {
    expect(mission.phase, mission.failure?.explanation ?? 'sin explicación').toBe('victory');
    expectAt(mission.t, 600, 'tiempo final');
  });

  it('todas las muestras son finitas, están en rango y la exposición no es negativa', () => {
    expect(mission.samples.length).toBeGreaterThan(1);
    expectFiniteSamples(mission.samples);
  });

  it('las muestras empiezan en 0, respetan la cadencia y terminan en el instante final', () => {
    const samples = mission.samples;
    expectAt(samples[0].t, 0, 'muestra inicial');
    for (let i = 1; i < samples.length - 1; i++) {
      expectAt(samples[i].t - samples[i - 1].t, engine.SAMPLE_EVERY, `cadencia entre muestras ${i - 1} y ${i}`);
    }
    const lastGap = samples[samples.length - 1].t - samples[samples.length - 2].t;
    expect(lastGap).toBeGreaterThan(0);
    expect(lastGap).toBeLessThanOrEqual(engine.SAMPLE_EVERY + EPS);
    expectAt(samples[samples.length - 1].t, mission.t, 'muestra final');
  });

  it('la última muestra coincide con el estado final medido', () => {
    const last: Sample = mission.samples[mission.samples.length - 1];
    expectAt(last.exposure, mission.exposure, 'exposición final', 0.5);
    expectAt(last.crewHealth, mission.game.crewHealth, 'salud final', 0.5);
    expect(last.sheltered).toBe(mission.game.sheltered);
  });

  it('emite cada frontera del escenario exactamente una vez y en orden', () => {
    expectOrderedEvents(mission.events);
    const boundaries: [number, Parameters<typeof countKind>[1]][] = [
      [180, 'darkness_warning'],
      [240, 'darkness_start'],
      [420, 'darkness_end'],
      [450, 'storm_warning'],
      [480, 'storm_start'],
      [540, 'storm_end'],
    ];
    for (const [t, kind] of boundaries) {
      const matches = mission.events.filter((event) => event.kind === kind);
      expect(matches.length, `${kind} debe aparecer una sola vez`).toBe(1);
      expectAt(matches[0].t, t, `frontera ${kind}`, engine.STEP);
    }
    expect(countKind(mission.events, 'victory'), 'evento de victoria').toBe(1);
    expect(countKind(mission.events, 'failure'), 'evento de fallo').toBe(0);
  });

  it('no duplica eventos en la misma frontera', () => {
    const keys = mission.events.map((event) => `${event.t}:${event.kind}`);
    expect(new Set(keys).size, 'hay eventos duplicados en la misma frontera').toBe(keys.length);
  });

  it('el registro de comandos está en orden y ok es booleano', () => {
    expectOrderedLog(mission.log);
    expect(mission.log.length).toBeGreaterThan(0);
    expect(mission.log.some((entry) => entry.ok)).toBe(true);
  });

  it('un comando rechazado se registra pero no altera la economía', () => {
    const probe = runMission(engine, DESIGNS.a(engine), { until: 10, policy: makePolicy() });
    const before = jsonClone(probe);
    const result = engine.applyCommand(probe, { type: 'setGrowLights', value: 150 });
    expect(result.ok).toBe(false);
    expect(result.reason?.length ?? 0).toBeGreaterThan(0);
    const after = jsonClone(probe);
    expect(after.log.length).toBe(before.log.length + 1);
    expect(after.log[after.log.length - 1].ok).toBe(false);
    before.log = after.log;
    expect(after).toEqual(before);
  });

  it('las métricas y el resumen usan las mismas cifras medidas', () => {
    const summary = engine.summarize(mission);
    expect(summary.phase).toBe(mission.phase);
    expect(summary.duration).toBeCloseTo(mission.t, 9);
    expect(summary.design).toEqual(mission.design);
    expect(summary.exposure).toBeCloseTo(mission.exposure, 9);
    expect(summary.harvests).toBe(mission.game.stats.harvests);
    expect(summary.minLifeSupport).toBeCloseTo(mission.metrics.minLifeSupport, 9);
    expect(summary.secondsLightsReduced).toBeCloseTo(mission.metrics.secondsLightsReduced, 9);
    expect(summary.secondsSheltered).toBeCloseTo(mission.metrics.secondsSheltered, 9);
    expect(summary.secondsShortage).toBeCloseTo(mission.metrics.secondsShortage, 9);
    expect(summary.minLifeSupport).toBeGreaterThanOrEqual(0);
    expect(summary.minLifeSupport).toBeLessThanOrEqual(100);
    for (const value of [summary.secondsLightsReduced, summary.secondsSheltered, summary.secondsShortage]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(summary.tradeoffs.length).toBeGreaterThanOrEqual(2);
    expect(summary.tradeoffs.length).toBeLessThanOrEqual(4);
    for (const text of summary.tradeoffs) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it('darknessAt y nextEvent describen la oscuridad sin adelantar acciones', () => {
    const probe = runMission(engine, DESIGNS.a(engine), { until: 300, policy: makePolicy() });
    expect(engine.darknessAt(probe).isDark).toBe(true);
    expect(engine.darknessAt(probe).secondsLeft).toBeGreaterThan(0);
    expect(engine.darknessAt(probe).secondsLeft).toBeLessThanOrEqual(120 + EPS);
    const next = engine.nextEvent(probe);
    expect(next).not.toBeNull();
    expect(next!.kind).toBe('darkness');
    expectAt(next!.endAt, 420, 'fin de la oscuridad en curso');
  });

  it('el estado no contiene NaN, Infinity, funciones ni referencias circulares', () => {
    expect(findNonSerializable(mission)).toEqual([]);
  });
});
