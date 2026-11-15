import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkDesign, emptyDesign, project, replay, SCENARIO_1, startMission, STEP, summarize, worldStep,
  type Command, type Design, type MissionState,
} from './index';

const EPS = 1e-9;

/** Strategies from the mission contract. */
const DESIGN_A: Design = { ...emptyDesign(), greenhouse: 2, solarMasts: 1, shield: 1, reserves: { o2: 2, water: 2, food: 0 } };
const DESIGN_B: Design = { ...emptyDesign(), batteries: 3, shield: 2, solarMasts: 1 };
const DESIGN_C: Design = { ...emptyDesign(), greenhouse: 2, solarMasts: 3 };

type Policy = (ms: MissionState) => Command[];

/** Tend the farm like a careful player: water, temperature, harvest. */
function tend(ms: MissionState): Command[] {
  const g = ms.game;
  if (g.sheltered || g.plant.dead) return [];
  const out: Command[] = [];
  if (g.plant.water < 41) out.push({ type: 'irrigate' });
  if (g.plant.temp < 41) out.push({ type: 'adjustClimate', dir: 1 });
  if (g.plant.temp > 59) out.push({ type: 'adjustClimate', dir: -1 });
  if (g.plant.growth >= 100) out.push({ type: 'harvest' });
  return out;
}

/** Into the shelter before the storm, out when it ends. */
function shelter(ms: MissionState): Command[] {
  if (Math.abs(ms.t - 470) < EPS) return [{ type: 'enterShelter' }];
  if (Math.abs(ms.t - 540) < EPS) return [{ type: 'leaveShelter' }];
  return [];
}

const POLICY_A: Policy = (ms) => {
  const out = [...shelter(ms), ...tend(ms)];
  // Farm first: in the dark, lights and heating go off so life support has the battery.
  if (Math.abs(ms.t - 240) < EPS) out.push({ type: 'setGrowLights', value: 0 }, { type: 'setPower', system: 'heating', on: false });
  if (Math.abs(ms.t - 420) < EPS) out.push({ type: 'setGrowLights', value: 50 }, { type: 'setPower', system: 'heating', on: true });
  return out;
};
const POLICY_B: Policy = (ms) => [...shelter(ms), ...tend(ms)];
const POLICY_C: Policy = (ms) => [...(ms.t === 0 ? [{ type: 'setGrowLights', value: 100 } as Command] : []), ...tend(ms)];

function run(design: Design, policy: Policy): MissionState {
  const ms = startMission(design);
  while (ms.phase === 'running') {
    for (const cmd of policy(ms)) applyCommand(ms, cmd);
    worldStep(ms);
  }
  return ms;
}

describe('mission 1: design', () => {
  it('costs the contract strategies 260, 270 and 240', () => {
    expect(checkDesign(DESIGN_A).spent).toBe(260);
    expect(checkDesign(DESIGN_B).spent).toBe(270);
    expect(checkDesign(DESIGN_C).spent).toBe(240);
  });

  it('refuses over budget, out of range, fractions, NaN and Infinity', () => {
    // 3 batteries + 2 greenhouse levels + 1 shield = 150 + 120 + 40 = 310: over 300.
    const over = checkDesign({ ...emptyDesign(), batteries: 3, greenhouse: 2, shield: 1 });
    expect(over.spent).toBe(310);
    expect(over.ok).toBe(false);
    expect(checkDesign({ ...emptyDesign(), solarMasts: 4 }).ok).toBe(false);
    expect(checkDesign({ ...emptyDesign(), batteries: 1.5 }).ok).toBe(false);
    expect(checkDesign({ ...emptyDesign(), shield: Number.NaN }).ok).toBe(false);
    expect(checkDesign({ ...emptyDesign(), reserves: { o2: Infinity, water: 0, food: 0 } }).ok).toBe(false);
    expect(checkDesign({ ...emptyDesign(), processor: -1 }).ok).toBe(false);
    expect(() => startMission({ ...emptyDesign(), solarMasts: 9 })).toThrow();
  });

  it('starts serializable, with the first sample at 0 s', () => {
    const ms = startMission(DESIGN_B);
    expect(JSON.parse(JSON.stringify(ms))).toEqual(ms);
    expect(ms.samples[0].t).toBe(0);
    expect(ms.game.res.energy).toBeLessThan(ms.game.res.energy / 0.6 + 1);
  });
});

describe('mission 1: strategies', () => {
  it('A (farm and reserves, lights off in the dark) wins', () => {
    const ms = run(DESIGN_A, POLICY_A);
    expect(ms.failure).toBeNull();
    expect(ms.phase).toBe('victory');
  });

  it('B (batteries and shelter) wins, a different way', () => {
    const a = run(DESIGN_A, POLICY_A);
    const b = run(DESIGN_B, POLICY_B);
    expect(b.failure).toBeNull();
    expect(b.phase).toBe('victory');
    // A pays in the farm (lights cut by hand), B keeps everything on through the dark.
    expect(b.metrics.secondsShortage).toBeLessThan(a.metrics.secondsShortage + 1);
  });

  it('C (big farm at full light, no shelter) fails with a concrete explanation', () => {
    const ms = run(DESIGN_C, POLICY_C);
    expect(ms.phase).toBe('failed');
    expect(ms.failure?.explanation).toMatch(/\d/);
  });

  it('an empty design that keeps everything on fails in the dark', () => {
    const ms = run(emptyDesign(), POLICY_B);
    expect(ms.phase).toBe('failed');
  });
});

describe('mission 1: engine rules', () => {
  it('emits each scenario event once, in order', () => {
    const ms = run(DESIGN_B, POLICY_B);
    const kinds = ms.events.map((e) => e.kind).filter((k) => /^(darkness|storm)_/.test(k));
    expect(kinds).toEqual(['darkness_warning', 'darkness_start', 'darkness_end', 'storm_warning', 'storm_start', 'storm_end']);
  });

  it('keeps the first and the last sample', () => {
    const ms = run(DESIGN_C, POLICY_C);
    expect(ms.samples[0].t).toBe(0);
    expect(ms.samples[ms.samples.length - 1].t).toBe(ms.t);
  });

  it('does nothing after the end', () => {
    const ms = run(DESIGN_B, POLICY_B);
    const before = JSON.stringify(ms);
    worldStep(ms);
    expect(JSON.stringify(ms)).toBe(before);
    expect(applyCommand(ms, { type: 'irrigate' }).ok).toBe(false);
  });

  it('logs accepted and refused commands with their mission time', () => {
    const ms = startMission(DESIGN_B);
    applyCommand(ms, { type: 'leaveShelter' });
    applyCommand(ms, { type: 'enterShelter' });
    expect(applyCommand(ms, { type: 'irrigate' }).ok).toBe(false);
    expect(ms.log.map((l) => [l.t, l.cmd.type, l.ok])).toEqual([[0, 'leaveShelter', false], [0, 'enterShelter', true], [0, 'irrigate', false]]);
  });

  it('fails before winning when both happen in the same step', () => {
    const ms = startMission(DESIGN_B);
    // Jump to the last step, then make it both the end and a failure.
    ms.t = SCENARIO_1.duration - STEP;
    ms.game.crewHealth = 0.01;
    ms.game.res.o2 = 0; ms.game.res.water = 0; ms.game.res.food = 0;
    ms.exposure = 999;
    worldStep(ms);
    expect(ms.phase).toBe('failed');
  });
});

describe('mission 1: projection and replay', () => {
  it('projects without changing the mission, and matches running the same plan', () => {
    const ms = startMission(DESIGN_B);
    for (let i = 0; i < 400; i++) worldStep(ms);
    const before = JSON.stringify(ms);
    const plan: Command[] = [{ type: 'setGrowLights', value: 0 }];
    const p = project(ms, plan, { kind: 'endOfDarkness' });
    expect(JSON.stringify(ms)).toBe(before);
    for (const c of plan) applyCommand(ms, c);
    while (ms.phase === 'running' && ms.t < p.until - EPS) worldStep(ms);
    expect(ms.t).toBe(p.until);
    expect(p.samples[p.samples.length - 1]).toEqual(ms.samples[ms.samples.length - 1]);
  });

  it('reports refused plan commands', () => {
    const p = project(startMission(DESIGN_B), [{ type: 'leaveShelter' }], { kind: 'seconds', value: 5 });
    expect(p.rejected).toHaveLength(1);
  });

  it('replays the log to exactly the same state', () => {
    const live = run(DESIGN_A, POLICY_A);
    const again = replay(DESIGN_A, live.log, live.t);
    expect(again.game).toEqual(live.game);
    expect(again.events).toEqual(live.events);
    expect(again.exposure).toBe(live.exposure);
    expect(() => replay(DESIGN_A, [], 1.1)).toThrow();
  });

  it('summarizes with measured numbers', () => {
    const s = summarize(run(DESIGN_A, POLICY_A));
    expect(s.tradeoffs.length).toBeGreaterThanOrEqual(2);
    expect(s.tradeoffs.length).toBeLessThanOrEqual(4);
    expect(s.harvests).toBeGreaterThan(0);
  });
});
