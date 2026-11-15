import { beforeEach, describe, expect, it } from 'vitest';
import { ENERGY, POWER, type Circuit } from './config';
import { solarMastsOutput } from './damage';
import { isPriority, movePriority, priorityOf, rankOf } from './power';
import { loadGame } from './save';
import { capacity, clamp, resolvePower, stepGreenhouse } from './sim';
import { newGame, type GameState } from './state';
import { developedGame } from './testing';

// The resolver as it was before circuits could be ranked, kept verbatim as the reference
// that free mode must still match exactly with the default order.
function legacyResolvePower(s: GameState, dt: number, isDay: boolean) {
  const generation = isDay ? ENERGY.landerSolar + solarMastsOutput(s) * ENERGY.solarPerMast : 0;
  const robotsCount = s.levels.collectorRobot + s.levels.harvesterRobot;
  const want = {
    lights: (s.power.growLights / 100) * ENERGY.growLightsMaxDraw * Math.min(1, s.levels.greenhouse),
    robots: s.power.robots && !s.sheltered && s.storm.phase !== 'active' && robotsCount > 0 ? ENERGY.robotDraw * robotsCount : 0,
    processor: s.levels.processor > 0 && s.power.processor && !s.sheltered ? ENERGY.processorDraw : 0,
    heating: s.power.heating && !isDay ? ENERGY.heatingDraw : 0,
  };
  let budget = s.res.energy / dt + generation - ENERGY.lifeSupportDraw;
  const lifeSupportPowered = budget >= 0;
  const on = { lights: 0, robots: false, processor: false, heating: false };
  if (want.heating > 0 && budget >= want.heating) { on.heating = true; budget -= want.heating; }
  if (want.processor > 0 && budget >= want.processor) { on.processor = true; budget -= want.processor; }
  if (want.robots > 0 && budget >= want.robots) { on.robots = true; budget -= want.robots; }
  if (want.lights > 0 && budget > 0) on.lights = s.power.growLights * Math.min(1, budget / want.lights);
  const demand = ENERGY.lifeSupportDraw + (on.heating ? want.heating : 0) + (on.processor ? want.processor : 0) +
    (on.robots ? want.robots : 0) + (want.lights > 0 ? want.lights * (on.lights / Math.max(1, s.power.growLights)) : 0);
  const shortage = (want.heating > 0 && !on.heating) || (want.processor > 0 && !on.processor) ||
    (want.robots > 0 && !on.robots) || on.lights < s.power.growLights - 0.5;
  s.res.energy = clamp(s.res.energy + (generation - demand) * dt, 0, capacity(s).energy);
  return { generation, demand, running: { ...on }, shortage, lifeSupportPowered };
}

function grid(): GameState[] {
  const out: GameState[] = [];
  for (const energy of [0, 0.05, 0.2, 0.4, 1, 5, 120])
    for (const isNightSetup of [false, true])
      for (const lights of [0, 0.4, 35, 100])
        for (const robots of [0, 2])
          for (const sheltered of [false, true]) {
            const s = developedGame();
            s.res.energy = energy;
            s.power.growLights = lights;
            s.power.heating = isNightSetup;
            s.levels.collectorRobot = robots ? 1 : 0;
            s.levels.harvesterRobot = robots ? 1 : 0;
            s.sheltered = sheltered;
            out.push(s);
          }
  return out;
}

const night = (s: GameState) => { s.power.heating = true; return s; };

describe('power priority', () => {
  it('with the default order, free mode resolves power exactly as before', () => {
    for (const s of grid()) {
      for (const isDay of [true, false]) {
        for (const dt of [0.25, 1]) {
          const a = structuredClone(s);
          const b = structuredClone(s);
          const now = resolvePower(a, dt, isDay);
          const before = legacyResolvePower(b, dt, isDay);
          expect({ ...now, available: undefined, shed: undefined }).toEqual({ ...before, available: undefined, shed: undefined });
          expect(a.res.energy).toBe(b.res.energy);
        }
      }
    }
  });

  it('new games and old saves start with the default order and the greenhouse breaker closed', () => {
    const s = newGame(0);
    expect(s.power.priority).toEqual([...POWER.defaultPriority]);
    expect(s.power.greenhouse).toBe(true);
    expect(priorityOf(s)).toEqual(POWER.defaultPriority);
  });

  it('a short budget feeds circuits in the chosen order', () => {
    const s = night(developedGame());
    s.res.energy = 0.25 * (ENERGY.lifeSupportDraw + 0.45);
    s.power.growLights = 50;
    s.power.processor = false;
    const lightsFirst = structuredClone(s);
    lightsFirst.power.priority = ['lifeSupport', 'greenhouse', 'heating', 'processor', 'robots'];
    const def = resolvePower(structuredClone(s), 0.25, false);
    const ranked = resolvePower(lightsFirst, 0.25, false);
    expect(def.running.heating).toBe(false);
    expect(ranked.running.heating).toBe(false);
    expect(ranked.running.lights).toBeCloseTo(50, 6);
    expect(ranked.shed).toContain('heating');
    expect(ranked.shed).not.toContain('greenhouse');
  });

  it('ranking life support last can leave the crew without it', () => {
    const s = night(developedGame());
    s.power.processor = false;
    s.power.growLights = 100;
    s.res.energy = 0.25 * 1.2;
    s.power.priority = ['greenhouse', 'heating', 'processor', 'robots', 'lifeSupport'];
    const r = resolvePower(s, 0.25, false);
    expect(r.running.lights).toBeCloseTo(100, 6);
    expect(r.lifeSupportPowered).toBe(false);
    expect(r.shed).toContain('lifeSupport');
  });

  it('the discharge limit makes the order matter even with a charged battery', () => {
    const s = night(developedGame());
    s.res.energy = 100;
    s.power.processor = false;
    s.power.growLights = 50;
    const free = resolvePower(structuredClone(s), 0.25, false);
    expect(free.shed).toEqual([]);
    const limited = resolvePower(structuredClone(s), 0.25, false, { dischargeLimit: 1.2 });
    expect(limited.available).toBeCloseTo(1.2, 9);
    expect(limited.running.heating).toBe(true);
    expect(limited.running.lights).toBeLessThan(50);
    expect(limited.shed).toEqual(['greenhouse']);
    const swapped = structuredClone(s);
    swapped.power.priority = ['lifeSupport', 'greenhouse', 'heating', 'processor', 'robots'];
    const other = resolvePower(swapped, 0.25, false, { dischargeLimit: 1.2 });
    expect(other.running.lights).toBeCloseTo(50, 6);
    expect(other.running.heating).toBe(false);
  });

  it('the batteries never give more than the limit in one step', () => {
    const s = night(developedGame());
    s.res.energy = 100;
    s.power.priority = ['greenhouse', 'heating', 'processor', 'robots', 'lifeSupport'];
    s.power.growLights = 100;
    resolvePower(s, 0.25, false, { dischargeLimit: 1 });
    expect(100 - s.res.energy).toBeLessThanOrEqual(0.25 + 1e-12);
  });

  it('opening the greenhouse breaker cuts the lights, saves energy and is not a shortage', () => {
    const s = night(developedGame());
    s.res.energy = 100;
    s.power.processor = false;
    const open = structuredClone(s);
    open.power.greenhouse = false;
    const on = resolvePower(structuredClone(s), 1, false);
    const off = resolvePower(open, 1, false);
    expect(off.running.lights).toBe(0);
    expect(off.demand).toBeLessThan(on.demand);
    expect(off.shortage).toBe(false);
    expect(off.shed).toEqual([]);
  });

  it('a dark greenhouse stresses the plant: the cost of the breaker is measurable', () => {
    const s = developedGame();
    s.power.greenhouse = false;
    for (let i = 0; i < 120; i++) {
      const r = resolvePower(s, 0.25, true);
      stepGreenhouse(s, 0.25, true, r.running);
    }
    expect(s.plant.light).toBeLessThan(40);
    expect(s.plant.stress).toBeGreaterThan(0);
  });

  it('accepts only orders that rank every circuit once', () => {
    expect(isPriority([...POWER.defaultPriority])).toBe(true);
    expect(isPriority(['lifeSupport', 'heating'])).toBe(false);
    expect(isPriority(['lifeSupport', 'lifeSupport', 'heating', 'processor', 'robots'])).toBe(false);
    expect(isPriority(['lifeSupport', 'heating', 'processor', 'robots', 'reactor'])).toBe(false);
    expect(isPriority('lifeSupport')).toBe(false);
    const broken = developedGame();
    broken.power.priority = ['heating'] as Circuit[];
    expect(priorityOf(broken)).toEqual(POWER.defaultPriority);
  });

  it('moves a circuit one place and reports its rank', () => {
    const up = movePriority(POWER.defaultPriority, 'greenhouse', -1);
    expect(up).toEqual(['lifeSupport', 'heating', 'processor', 'greenhouse', 'robots']);
    expect(movePriority(POWER.defaultPriority, 'lifeSupport', -1)).toEqual([...POWER.defaultPriority]);
    const s = developedGame();
    s.power.priority = up;
    expect(rankOf(s, 'greenhouse')).toBe(4);
  });
});

describe('saves from before circuits', () => {
  const store = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  beforeEach(() => store.clear());

  it('load with the default order and the greenhouse on, keeping the player settings', () => {
    const old = newGame(0) as unknown as { power: Record<string, unknown> };
    old.power = { heating: false, processor: true, robots: false, growLights: 35 };
    store.set('nexus.save.v1', JSON.stringify(old));
    const back = loadGame()!;
    expect(back.power).toEqual({ heating: false, processor: true, robots: false, growLights: 35, greenhouse: true, priority: [...POWER.defaultPriority] });
  });
});
