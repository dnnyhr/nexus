import { describe, expect, it } from 'vitest';
import { SCENARIO_1, applyCommand, checkDesign, emptyDesign, project, replay, startMission, worldStep } from './index';

describe('mission engine', () => {
  it('starts deterministically with independent JSON state', () => {
    const design = emptyDesign();
    const a = startMission(design);
    const b = startMission(design);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    design.reserves.o2 = 5;
    expect(a.design.reserves.o2).toBe(0);
    expect(a.game.savedAt).toBe(0);
    expect(a.samples[0].t).toBe(0);
  });

  it('rejects overbudget 305 and noninteger/nonfinite designs', () => {
    expect(checkDesign({ ...emptyDesign(), batteries: 3, solarMasts: 1, shield: 1, reserves: { o2: 5, water: 0, food: 0 } })).toMatchObject({ ok: false, spent: 305 });
    for (const solarMasts of [NaN, Infinity, -1, 0.5, 4]) {
      const d = { ...emptyDesign(), solarMasts };
      expect(checkDesign(d).ok).toBe(false);
      expect(() => startMission(d)).toThrow();
    }
  });

  it('projects with real rules, future-only events and no source mutation', () => {
    const ms = startMission(emptyDesign());
    while (ms.t < 180) worldStep(ms);
    const original = structuredClone(ms);
    const p = project(ms, [{ type: 'enterShelter' }], { kind: 'seconds', value: 60 });
    expect(ms).toEqual(original);
    applyCommand(ms, { type: 'enterShelter' });
    while (ms.t < 240) worldStep(ms);
    expect(p.samples.at(-1)).toEqual(ms.samples.at(-1));
    expect(p.events.some(e => e.kind === 'darkness_warning')).toBe(false);
    expect(p.events).toEqual(ms.events.slice(original.events.length));
    expect(p.until).toBe(240);
  });

  it('replays accepted, rejected and simultaneous commands exactly', () => {
    const ms = startMission(emptyDesign());
    applyCommand(ms, { type: 'harvest' });
    applyCommand(ms, { type: 'setGrowLights', value: 50 });
    while (ms.t < 30) worldStep(ms);
    applyCommand(ms, { type: 'enterShelter' });
    applyCommand(ms, { type: 'enterShelter' });
    while (ms.t < 60) worldStep(ms);
    expect(replay(ms.design, ms.log, ms.t)).toEqual(ms);
    expect(() => replay(ms.design, ms.log, 0.1)).toThrow();
    expect(() => project(ms, [], { kind: 'seconds', value: NaN })).toThrow();
  });

  it('emits each scenario frontier once and stops after victory', () => {
    const ms = startMission({ ...emptyDesign(), batteries: 3, shield: 2 });
    applyCommand(ms, { type: 'enterShelter' });
    while (ms.phase === 'running') worldStep(ms);
    for (const [kind, t] of [['darkness_warning', 180], ['darkness_start', 240], ['darkness_end', 420], ['storm_warning', 450], ['storm_start', 480], ['storm_end', 540], ['victory', 600]]) {
      expect(ms.events.filter(e => e.kind === kind).map(e => e.t)).toEqual([t]);
    }
    const before = structuredClone(ms);
    worldStep(ms);
    expect(ms).toEqual(before);
    expect(ms.samples.at(-1)?.t).toBe(SCENARIO_1.duration);
  });
});
