import { describe, expect, it } from 'vitest';
import { capacity, collectByHand, lifeSupportPercent, step } from './sim';
import { newGame } from './state';

const run = (s: ReturnType<typeof newGame>, seconds: number) => {
  for (let i = 0; i < seconds; i++) step(s, 1);
};

describe('resources', () => {
  it('the crew consumes oxygen, water and food over time', () => {
    const s = newGame();
    s.power.processor = false;
    const before = { ...s.res };
    run(s, 60);
    expect(s.res.o2).toBeLessThan(before.o2);
    expect(s.res.water).toBeLessThan(before.water);
    expect(s.res.food).toBeLessThan(before.food);
  });

  it('the processor turns regolith into oxygen and materials', () => {
    const s = newGame();
    s.res.regolith = 50;
    const o2 = s.res.o2;
    const mat = s.res.materials;
    run(s, 20);
    expect(s.res.regolith).toBeLessThan(50);
    expect(s.res.materials).toBeGreaterThan(mat);
    expect(s.res.o2).toBeGreaterThan(o2 - 20 * 0.07); // net O2 better than crew use alone
  });

  it('collecting by hand never exceeds storage', () => {
    const s = newGame();
    s.res.regolith = capacity(s).regolith - 1;
    expect(collectByHand(s)).toBe(1);
    expect(collectByHand(s)).toBe(0);
  });

  it('crew health drops when a life resource runs out and production stops at zero health', () => {
    const s = newGame();
    s.res.food = 0;
    s.res.regolith = 100;
    run(s, 300);
    expect(s.crewHealth).toBe(0);
    const reg = s.res.regolith;
    run(s, 10);
    expect(s.res.regolith).toBe(reg);
  });

  it('life support shows the weakest resource', () => {
    const s = newGame();
    s.res.o2 = 100;
    s.res.water = 100;
    s.res.food = 10;
    expect(lifeSupportPercent(s)).toBeCloseTo(10);
  });
});
