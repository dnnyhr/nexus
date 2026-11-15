import { describe, expect, it } from 'vitest';
import { COLLECT, CYCLE } from './config';
import { collectByHand, deliverRegolith, lifeSupportPercent, step, tick } from './sim';
import { developedGame } from './testing';

const run = (s: ReturnType<typeof developedGame>, seconds: number) => {
  for (let i = 0; i < seconds; i++) step(s, 1);
};

describe('resources', () => {
  it('the crew consumes oxygen, water and food over time', () => {
    const s = developedGame();
    s.power.processor = false;
    const before = { ...s.res };
    run(s, 60);
    expect(s.res.o2).toBeLessThan(before.o2);
    expect(s.res.water).toBeLessThan(before.water);
    expect(s.res.food).toBeLessThan(before.food);
  });

  it('the processor turns regolith into oxygen and materials', () => {
    const s = developedGame();
    s.res.regolith = 50;
    const o2 = s.res.o2;
    const mat = s.res.materials;
    run(s, 20);
    expect(s.res.regolith).toBeLessThan(50);
    expect(s.res.materials).toBeGreaterThan(mat);
    expect(s.res.o2).toBeGreaterThan(o2 - 20 * 0.07); // net O2 better than crew use alone
  });

  it('digging fills the bag, and the processor only gets regolith when it is delivered', () => {
    const s = developedGame();
    s.res.regolith = 0;
    for (let i = 0; i < 5; i++) collectByHand(s);
    expect(s.carried).toBe(COLLECT.carryMax);
    expect(collectByHand(s)).toBe(0);
    expect(s.res.regolith).toBe(0);
    expect(deliverRegolith(s)).toBe(COLLECT.carryMax);
    expect(s.carried).toBe(0);
    expect(s.res.regolith).toBe(COLLECT.carryMax);
  });

  it('nothing can be delivered without a processor', () => {
    const s = developedGame();
    s.levels.processor = 0;
    collectByHand(s);
    expect(deliverRegolith(s)).toBe(0);
    expect(s.carried).toBeGreaterThan(0);
  });

  it('crew health drops when a life resource runs out and production stops at zero health', () => {
    const s = developedGame();
    s.res.food = 0;
    s.res.regolith = 100;
    run(s, 300);
    expect(s.crewHealth).toBe(0);
    const reg = s.res.regolith;
    run(s, 10);
    expect(s.res.regolith).toBe(reg);
  });

  it('life support shows the weakest resource', () => {
    const s = developedGame();
    s.res.o2 = 100;
    s.res.water = 100;
    s.res.food = 10;
    expect(lifeSupportPercent(s)).toBeCloseTo(10);
  });
});

describe('energy and the lunar night', () => {
  it('solar masts charge the battery during the day', () => {
    const s = developedGame();
    s.res.energy = 10;
    s.power.processor = false;
    run2(s, 30);
    expect(s.res.energy).toBeGreaterThan(10);
  });

  it('at night the battery drains and systems are shed, life support last', () => {
    const s = developedGame();
    s.time = CYCLE.daySeconds; // start of the night
    s.res.energy = 20;
    s.power.growLights = 100;
    const reports = [];
    for (let i = 0; i < 40; i++) reports.push(tick(s, 1));
    const firstShortage = reports.find((r) => r.shortage)!;
    expect(firstShortage).toBeDefined();
    expect(firstShortage.running.lights).toBeLessThan(100);
    // Other systems are shed while life support still has power.
    expect(firstShortage.lifeSupportPowered).toBe(true);
    // Only when the battery is truly empty does life support fail.
    expect(reports[reports.length - 1].lifeSupportPowered).toBe(false);
  });

  it('turning systems off at night saves the battery', () => {
    const a = developedGame();
    const b = developedGame();
    for (const s of [a, b]) { s.time = CYCLE.daySeconds; s.res.energy = 100; }
    b.power = { ...b.power, heating: false, processor: false, robots: false, growLights: 0 };
    run2(a, 60);
    run2(b, 60);
    expect(b.res.energy).toBeGreaterThan(a.res.energy);
  });
});

function run2(s: ReturnType<typeof developedGame>, seconds: number) {
  for (let i = 0; i < seconds; i++) tick(s, 1);
}

describe('a new game starts with only the lander', () => {
  it('has no buildings, a few materials, and the lander keeps power up by day', async () => {
    const { newGame } = await import('./state');
    const s = newGame();
    expect(s.levels).toMatchObject({ antenna: 0, station: 0, greenhouse: 0, processor: 0 });
    expect(s.counts.solarMast).toBe(0);
    expect(s.res.materials).toBeGreaterThan(0);
    s.res.energy = 10;
    for (let i = 0; i < 20; i++) tick(s, 1);
    expect(s.res.energy).toBeGreaterThan(10);
  });
});
