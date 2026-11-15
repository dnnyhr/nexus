import { beforeAll, describe, expect, it } from 'vitest';
import type { Design, DesignItem, MissionState, Scenario } from '../../src/engine/types';
import {
  DESIGNS,
  designFor,
  engineAvailable,
  farmPolicy,
  loadEngine,
  runMission,
  type MissionEngine,
  type Policy,
} from './support/engine';

const suite = engineAvailable ? describe : describe.skip;

const EXPECTED_PRICES: Record<DesignItem, number> = {
  solarMasts: 40,
  batteries: 50,
  greenhouse: 60,
  processor: 50,
  shield: 40,
  reserveO2: 15,
  reserveWater: 15,
  reserveFood: 15,
};

const EXPECTED_LIMITS: Record<DesignItem, number> = {
  solarMasts: 3,
  batteries: 3,
  greenhouse: 2,
  processor: 1,
  shield: 3,
  reserveO2: 5,
  reserveWater: 5,
  reserveFood: 5,
};

const STRATEGIES = {
  a: () => farmPolicy({ lights: 55, reduceLightsInDarkness: true, shelterFromStorm: true, irrigateBelow: 38 }),
  b: () => farmPolicy({ lights: 55, reduceLightsInDarkness: false, shelterFromStorm: true, irrigateBelow: 44 }),
  c: () => farmPolicy({ lights: 100, reduceLightsInDarkness: false, shelterFromStorm: false, irrigateBelow: 38 }),
};

suite('diseño, costes y balance de Misión 1 (motor real)', () => {
  let engine: MissionEngine;

  beforeAll(async () => {
    engine = await loadEngine();
  });

  it('precios, límites y diseño vacío coinciden con el contrato', () => {
    expect(engine.PRICES).toEqual(EXPECTED_PRICES);
    expect(engine.LIMITS).toEqual(EXPECTED_LIMITS);
    const empty = engine.emptyDesign();
    expect(empty).toEqual({
      solarMasts: 0,
      batteries: 0,
      greenhouse: 0,
      processor: 0,
      shield: 0,
      reserves: { o2: 0, water: 0, food: 0 },
    });
    const check = engine.checkDesign(empty);
    expect(check.ok).toBe(true);
    expect(check.spent).toBe(0);
    expect(check.reasons).toEqual([]);
  });

  it('A, B y C cuestan 260, 270 y 240 créditos', () => {
    const a = engine.checkDesign(DESIGNS.a(engine));
    const b = engine.checkDesign(DESIGNS.b(engine));
    const c = engine.checkDesign(DESIGNS.c(engine));
    expect(a).toMatchObject({ ok: true, spent: 260, budget: 300 });
    expect(b).toMatchObject({ ok: true, spent: 270, budget: 300 });
    expect(c).toMatchObject({ ok: true, spent: 240, budget: 300 });
  });

  it('el caso 305 supera el presupuesto y explica el rechazo', () => {
    const over = designFor(engine, {
      batteries: 3,
      solarMasts: 1,
      shield: 1,
      reserves: { o2: 5 },
    });
    const check = engine.checkDesign(over);
    expect(check.ok).toBe(false);
    expect(check.spent).toBe(305);
    expect(check.reasons.length).toBeGreaterThan(0);
    expect(() => engine.startMission(over)).toThrow();
  });

  for (const item of Object.keys(EXPECTED_LIMITS) as DesignItem[]) {
    it(`rechaza ${item} por encima del máximo`, () => {
      const patch: Partial<Design> & { reserves?: Partial<Design['reserves']> } = {};
      if (item === 'reserveO2' || item === 'reserveWater' || item === 'reserveFood') {
        const key = item === 'reserveO2' ? 'o2' : item === 'reserveWater' ? 'water' : 'food';
        patch.reserves = { [key]: EXPECTED_LIMITS[item] + 1 };
      } else {
        patch[item] = EXPECTED_LIMITS[item] + 1;
      }
      const design = designFor(engine, patch);
      const check = engine.checkDesign(design);
      expect(check.ok, `${item} sobre el máximo fue aceptado`).toBe(false);
      expect(check.reasons.length).toBeGreaterThan(0);
    });
  }

  for (const item of Object.keys(EXPECTED_LIMITS) as DesignItem[]) {
    it(`rechaza ${item} con NaN, Infinity, negativo o fracción`, () => {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5]) {
        const patch: Partial<Design> & { reserves?: Partial<Design['reserves']> } = {};
        if (item === 'reserveO2' || item === 'reserveWater' || item === 'reserveFood') {
          const key = item === 'reserveO2' ? 'o2' : item === 'reserveWater' ? 'water' : 'food';
          patch.reserves = { [key]: value };
        } else {
          patch[item] = value;
        }
        const design = designFor(engine, patch);
        const check = engine.checkDesign(design);
        expect(check.ok, `${item}=${value} fue aceptado`).toBe(false);
        expect(check.reasons.length).toBeGreaterThan(0);
      }
    });
  }

  it('cada compra se refleja en el estado inicial', () => {
    const base = engine.startMission(engine.emptyDesign());
    const masts = engine.startMission(designFor(engine, { solarMasts: 2 }));
    const batteries = engine.startMission(designFor(engine, { batteries: 2 }));
    const greenhouse = engine.startMission(designFor(engine, { greenhouse: 1 }));
    const processor = engine.startMission(designFor(engine, { processor: 1 }));
    const shield = engine.startMission(designFor(engine, { shield: 2 }));
    const reserves = engine.startMission(
      designFor(engine, { reserves: { o2: 2, water: 2, food: 2 } }),
    );

    expect(masts.game.counts.solarMast - base.game.counts.solarMast).toBe(2);
    expect(batteries.game.counts.battery - base.game.counts.battery).toBe(2);
    expect(greenhouse.game.levels.greenhouse - base.game.levels.greenhouse).toBe(1);
    expect(processor.game.levels.processor - base.game.levels.processor).toBe(1);
    expect(shield.game.levels.shield - base.game.levels.shield).toBe(2);
    expect(reserves.game.res.o2).toBeGreaterThan(base.game.res.o2);
    expect(reserves.game.res.water).toBeGreaterThan(base.game.res.water);
    expect(reserves.game.res.food).toBeGreaterThan(base.game.res.food);
  });

  it('la berma nivel 2 alcanza el tope: nivel 3 no añade reducción de exposición', () => {
    const stormScenario: Scenario = {
      ...engine.SCENARIO_1,
      duration: 20,
      events: [{ kind: 'storm', warnAt: 0, startAt: 1, endAt: 11, strength: 1 }],
    };
    const shelter: Policy = (mission, api) => {
      if (mission.t >= 1 && mission.t < 11) api.applyCommand(mission, { type: 'enterShelter' });
      else if (mission.t >= 11) api.applyCommand(mission, { type: 'leaveShelter' });
    };
    const withTwo = engine.startMission(designFor(engine, { shield: 2 }), stormScenario);
    const withThree = engine.startMission(designFor(engine, { shield: 3 }), stormScenario);
    for (const mission of [withTwo, withThree]) {
      while (mission.phase === 'running' && mission.t < stormScenario.duration) {
        shelter(mission, engine);
        engine.worldStep(mission);
      }
    }
    expect(withThree.exposure).toBeCloseTo(withTwo.exposure, 6);
    expect(withThree.phase).toBe(withTwo.phase);
  });

  it('la estrategia A gana y registra cosechas reales sin exposición excesiva', () => {
    const mission = runMission(engine, DESIGNS.a(engine), { policy: STRATEGIES.a() });
    expect(mission.phase, mission.failure?.explanation ?? 'sin explicación').toBe('victory');
    expect(mission.exposure).toBeLessThanOrEqual(mission.scenario.exposureLimit);
    const summary = engine.summarize(mission);
    expect(summary.phase).toBe('victory');
    expect(summary.harvests).toBeGreaterThanOrEqual(1);
    expect(mission.events.some((event) => event.kind === 'harvest')).toBe(true);
    expect(summary.tradeoffs.length).toBeGreaterThan(0);
  });

  it('la estrategia B gana con un diseño distinto de A', () => {
    const a = runMission(engine, DESIGNS.a(engine), { policy: STRATEGIES.a() });
    const b = runMission(engine, DESIGNS.b(engine), { policy: STRATEGIES.b() });
    expect(b.phase, b.failure?.explanation ?? 'sin explicación').toBe('victory');
    expect(b.design).not.toEqual(a.design);
    const summary = engine.summarize(b);
    expect(summary.phase).toBe('victory');
    expect(summary.harvests).toBeGreaterThanOrEqual(1);
  });

  it('la estrategia C falla con explicación concreta', () => {
    const c = runMission(engine, DESIGNS.c(engine), { policy: STRATEGIES.c() });
    expect(c.phase).toBe('failed');
    expect(c.failure).not.toBeNull();
    expect(c.failure!.explanation.length).toBeGreaterThan(0);
    expect(c.failure!.explanation).toMatch(/\d/);
    expect(engine.summarize(c).phase).toBe('failed');
  });
});
