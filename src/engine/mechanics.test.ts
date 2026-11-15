import { describe, expect, it, vi } from 'vitest';
import snapshot from '../data/snapshot.json';
import { capacity, resolvePower } from '../game/sim';
import { protection } from '../game/storm';
import {
  applyCommand, emptyDesign, MISSION_RULES, project, replay, SCENARIO_1, SCENARIO_SOURCE,
  startMission, STEP, summarize, worldStep,
} from './index';
import type { Scenario } from './types';

const shortScenario = (duration = 25): Scenario => ({ ...structuredClone(SCENARIO_1), events: [], duration });
const advance = (ms: ReturnType<typeof startMission>, until: number) => {
  while (ms.t < until && ms.phase === 'running') worldStep(ms);
};

describe('mission mechanics', () => {
  it('charges half of added capacity, caps reserve packs at full storage', () => {
    const a = startMission(emptyDesign());
    const b = startMission({ ...emptyDesign(), batteries: 2, reserves: { o2: 5, water: 0, food: 0 } });
    expect(capacity(b.game).energy - capacity(a.game).energy).toBe(600);
    expect(b.game.res.energy - a.game.res.energy).toBe(300);
    expect(b.game.res.o2).toBe(capacity(b.game).o2);
  });

  it('costs more power per greenhouse level using shared power allocation', () => {
    const a = startMission(emptyDesign());
    const b = startMission({ ...emptyDesign(), greenhouse: 2 });
    worldStep(a);
    worldStep(b);
    expect(b.lastPower.demand - a.lastPower.demand).toBeCloseTo(0.9);
    expect(b.lastPower.running.lights).toBe(a.lastPower.running.lights);
    expect(b.ledger.energy.lights).toBeCloseTo(a.ledger.energy.lights * 3);
  });

  it('shelter stops production/growth, keeps maintenance and thermal/water drift', () => {
    const ms = startMission({ ...emptyDesign(), processor: 1 });
    ms.game.res.regolith = 10;
    ms.game.plant.growth = 30;
    applyCommand(ms, { type: 'enterShelter' });
    const before = structuredClone(ms);
    for (let i = 0; i < 4; i++) worldStep(ms);
    expect(ms.game.plant.growth).toBe(30);
    expect(ms.game.plant.water).toBeLessThan(before.game.plant.water);
    expect(ms.game.plant.temp).toBeGreaterThan(before.game.plant.temp);
    expect(ms.game.res.regolith).toBe(10);
    expect(ms.lastPower.running).toMatchObject({ processor: false, robots: false, lights: 0 });
    expect(ms.lastPower.shortage).toBe(false);
    expect(ms.lastPower.demand).toBe(0.6);
    expect(ms.metrics.secondsSheltered).toBe(1);
    expect(ms.metrics.secondsLightsReduced).toBe(0);
    expect(applyCommand(ms, { type: 'harvest' }).ok).toBe(false);
    expect(applyCommand(ms, { type: 'enterShelter' }).ok).toBe(false);
    expect(ms.events.filter(e => e.kind === 'shelter_enter')).toHaveLength(1);
  });

  it('does not count involuntary low light as manual light restriction', () => {
    const ms = startMission(emptyDesign());
    advance(ms, 240);
    ms.game.res.energy = 0;
    worldStep(ms);
    expect(ms.metrics.secondsShortage).toBe(STEP);
    expect(ms.metrics.secondsLightsReduced).toBe(0);
    applyCommand(ms, { type: 'setGrowLights', value: 20 });
    worldStep(ms);
    expect(ms.metrics.secondsLightsReduced).toBe(STEP);
  });

  it('does not double-count suit protection or apply berms outside', () => {
    for (const shield of [0, 1, 2, 3]) {
      const ms = startMission({ ...emptyDesign(), shield });
      advance(ms, 480);
      const before = ms.exposure;
      worldStep(ms);
      expect(ms.exposure - before).toBeCloseTo(0.8 * (1 - protection(ms.game)) * STEP);
      expect(ms.exposure - before).toBeCloseTo(0.18);
    }
    const a = startMission({ ...emptyDesign(), shield: 2 });
    const b = startMission({ ...emptyDesign(), shield: 3 });
    a.game.sheltered = b.game.sheltered = true;
    expect(protection(a.game)).toBe(0.97);
    expect(protection(a.game)).toBe(protection(b.game));
  });

  it('fails only after more than grace and keeps final off-cadence sample', () => {
    const ms = startMission(emptyDesign(), shortScenario());
    ms.game.res.o2 = 0;
    advance(ms, 20);
    expect(ms.phase).toBe('running');
    worldStep(ms);
    expect(ms.failure).toMatchObject({ code: 'o2_depleted', t: 20.25 });
    expect(ms.samples.at(-1)?.t).toBe(20.25);
  });

  it('gives failure precedence at the victory boundary', () => {
    const ms = startMission(emptyDesign(), shortScenario(20.25));
    ms.game.res.o2 = 0;
    advance(ms, 20.25);
    expect(ms.phase).toBe('failed');
    expect(ms.events.some(e => e.kind === 'victory')).toBe(false);
  });

  it('crops, commands and projection count actual future harvests only', () => {
    const ms = startMission(emptyDesign());
    ms.game.plant.growth = 100;
    applyCommand(ms, { type: 'harvest' });
    ms.game.plant.growth = 100;
    const p = project(ms, [{ type: 'harvest' }], { kind: 'seconds', value: 0.25 });
    expect(p.events.filter(e => e.kind === 'harvest')).toHaveLength(1);
    expect(ms.game.stats.harvests).toBe(1);
    const noHuman = project(ms, [], { kind: 'seconds', value: 10 });
    expect(noHuman.events.filter(e => e.kind === 'harvest')).toHaveLength(0);
  });

  it('reports real reached horizon, plan rejections and partial final samples', () => {
    const ms = startMission(emptyDesign());
    const p = project(ms, [{ type: 'setGrowLights', value: -1 }], { kind: 'seconds', value: 1.25 });
    expect(p.until).toBe(1.25);
    expect(p.samples.map(s => s.t)).toEqual([0, 1.25]);
    expect(p.rejected).toHaveLength(1);
    const failure = project(ms, [], { kind: 'endOfMission' });
    expect(failure.phase).toBe('failed');
    expect(failure.until).toBeLessThan(600);
    expect(failure.samples.at(-1)?.t).toBe(failure.until);
  });

  it('rejects out-of-order logs and mismatched acceptance flags', () => {
    const d = emptyDesign();
    expect(() => replay(d, [{ t: 1, cmd: { type: 'enterShelter' }, ok: true }, { t: 0, cmd: { type: 'leaveShelter' }, ok: true }], 10)).toThrow('Log');
    expect(() => replay(d, [{ t: 0, cmd: { type: 'harvest' }, ok: true }], 1)).toThrow('no coincide');
  });

  it('radio figures reflect state at each event rather than canned values', () => {
    const ms = startMission({ ...emptyDesign(), shield: 1 });
    applyCommand(ms, { type: 'setGrowLights', value: 20 });
    advance(ms, 420);
    const pct = Number((ms.game.res.energy / capacity(ms.game).energy * 100).toFixed(2));
    expect(ms.events.find(e => e.kind === 'darkness_end')?.text).toContain(`batería ${pct} %`);
    expect(ms.events.find(e => e.kind === 'darkness_end')?.text).toContain(`luces reducidas ${ms.metrics.secondsLightsReduced} s`);
    applyCommand(ms, { type: 'enterShelter' });
    advance(ms, 540);
    expect(ms.events.find(e => e.kind === 'storm_end')?.text).toContain(`exposición ${Number(ms.exposure.toFixed(2))} u`);
    expect(ms.events.find(e => e.kind === 'power_shortage')?.text).toContain('luces efectivas');
  });

  it('uses a dated local flare and marks source as a fixed scenario', () => {
    const inspiredBy = SCENARIO_1.events.find(e => e.kind === 'storm')?.inspiredBy;
    expect(snapshot.flares.find(f => f.id === inspiredBy?.id)).toEqual(inspiredBy);
    expect(SCENARIO_SOURCE).toMatchObject({ live: false, fetchedAt: snapshot.fetchedAt, label: 'Escenario fijo inspirado en dato real' });
    expect(startMission(emptyDesign()).game.storm.live).toBe(false);
  });

  it('summary uses measured metrics and owns its returned data', () => {
    const ms = startMission(emptyDesign());
    applyCommand(ms, { type: 'setGrowLights', value: 20 });
    advance(ms, 3.25);
    const s = summarize(ms);
    expect(s.secondsLightsReduced).toBe(3.25);
    s.design.reserves.o2 = 5;
    expect(ms.design.reserves.o2).toBe(0);
    expect(s.tradeoffs.join(' ')).toContain('3.25 s');
  });

  it('matches shared kernel power for ordinary level-one day operation', () => {
    const ms = startMission(emptyDesign());
    const free = structuredClone(ms.game);
    const report = resolvePower(free, STEP, true);
    worldStep(ms);
    expect(ms.lastPower).toEqual(report);
    expect(ms.game.res.energy).toBe(free.res.energy);
    expect(MISSION_RULES.initialGrowLights).toBe(50);
  });

  it('charges fractional LED settings exactly without artificial storage credits', () => {
    for (const value of [0.01, 0.5, 1, 49.75, 100]) {
      const ms = startMission(emptyDesign());
      applyCommand(ms, { type: 'setGrowLights', value });
      worldStep(ms);
      expect(ms.lastPower.demand).toBeCloseTo(0.6 + value / 100 * 0.9, 10);
      expect(ms.ledger.energy.storage).toBeCloseTo(0, 10);
    }
  });

  it('keeps invalid nonfinite command logs JSON serializable and replayable', () => {
    const ms = startMission(emptyDesign());
    for (const value of [NaN, Infinity, -Infinity]) expect(applyCommand(ms, { type: 'setGrowLights', value }).ok).toBe(false);
    expect(JSON.parse(JSON.stringify(ms))).toEqual(ms);
    expect(replay(ms.design, ms.log, 0)).toEqual(ms);
  });

  it('emits zero-time scenario events once and respects initial darkness', () => {
    const scenario = shortScenario(10);
    scenario.events = [{ kind: 'darkness', warnAt: 0, startAt: 0, endAt: 5 }];
    const ms = startMission(emptyDesign(), scenario);
    expect(ms.events.map(e => [e.kind, e.t])).toEqual([['darkness_warning', 0], ['darkness_start', 0]]);
    expect(ms.samples[0].isDark).toBe(true);
    advance(ms, 10);
    expect(ms.events.filter(e => e.kind === 'darkness_start')).toHaveLength(1);
    expect(ms.events.filter(e => e.kind === 'darkness_end')).toHaveLength(1);
  });

  it('records vital power failure even when all optional systems are off', () => {
    const scenario = shortScenario(10);
    scenario.events = [{ kind: 'darkness', warnAt: 0, startAt: 0, endAt: 5 }];
    const ms = startMission(emptyDesign(), scenario);
    ms.game.res.energy = 0;
    applyCommand(ms, { type: 'setGrowLights', value: 0 });
    applyCommand(ms, { type: 'setPower', system: 'heating', on: false });
    worldStep(ms);
    expect(ms.lastPower.lifeSupportPowered).toBe(false);
    expect(ms.lastPower.shortage).toBe(true);
    expect(ms.metrics.secondsShortage).toBe(STEP);
    expect(ms.ledger.energy.crew).toBe(0);
  });

  it('never reads wall clock, randomness, network or storage for simulation', () => {
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Wall clock'); });
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Random'); });
    const net = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Network'); });
    try {
      const ms = startMission(emptyDesign());
      advance(ms, 10);
      project(ms, [], { kind: 'seconds', value: 10 });
      expect(replay(ms.design, ms.log, 10)).toEqual(ms);
      expect(clock).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
      expect(net).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
      random.mockRestore();
      net.mockRestore();
    }
  });
});
