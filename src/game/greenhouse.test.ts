import { describe, expect, it } from 'vitest';
import { CYCLE, GREENHOUSE } from './config';
import { adjustClimate, harvest, irrigate, replant, stepGreenhouse, tick } from './sim';
import { developedGame } from './testing';

const day = { processor: false, robots: true, heating: false, lights: 50 };

describe('greenhouse', () => {
  it('a plant kept in range grows to harvest and gives food', () => {
    const s = developedGame();
    for (let i = 0; i < 400 && s.plant.growth < 100; i++) {
      s.plant.water = 50;
      s.plant.temp = 50;
      stepGreenhouse(s, 1, true, day);
    }
    expect(s.plant.growth).toBe(100);
    const food = s.res.food;
    expect(harvest(s)).toBeGreaterThan(0);
    expect(s.res.food).toBeGreaterThan(food);
    expect(s.plant.growth).toBe(0);
  });

  it('out-of-range parameters add stress and stop growth', () => {
    const s = developedGame();
    s.plant.water = 5;
    s.plant.temp = 95;
    for (let i = 0; i < 40; i++) stepGreenhouse(s, 1, true, { ...day, lights: 5 });
    expect(s.plant.stress).toBeGreaterThanOrEqual(GREENHOUSE.stressNoGrowth);
    const g = s.plant.growth;
    stepGreenhouse(s, 1, true, { ...day, lights: 5 });
    expect(s.plant.growth).toBe(g);
  });

  it('a plant at max stress for too long dies, and replanting costs materials', () => {
    const s = developedGame();
    s.plant.stress = 100;
    s.plant.water = 0;
    for (let i = 0; i < GREENHOUSE.deathSeconds + 2; i++) stepGreenhouse(s, 1, false, { ...day, lights: 0 });
    expect(s.plant.dead).toBe(true);
    const mat = s.res.materials;
    expect(replant(s)).toBe(true);
    expect(s.res.materials).toBe(mat - GREENHOUSE.replantMaterials);
    expect(s.plant.dead).toBe(false);
  });

  it('offline the plant wilts but never dies', () => {
    const s = developedGame();
    s.plant.water = 0;
    s.plant.stress = 99;
    for (let i = 0; i < 600; i++) stepGreenhouse(s, 1, false, { ...day, lights: 0 }, true);
    expect(s.plant.dead).toBe(false);
  });

  it('irrigation spends water and too much water is also out of range', () => {
    const s = developedGame();
    const water = s.res.water;
    s.plant.water = 50;
    irrigate(s);
    expect(s.res.water).toBe(water - GREENHOUSE.waterPerIrrigation);
    expect(s.plant.water).toBeGreaterThan(GREENHOUSE.optimalMax);
  });

  it('heating costs energy, and at night without heating the greenhouse cools', () => {
    const s = developedGame();
    const e = s.res.energy;
    adjustClimate(s, 1);
    expect(s.res.energy).toBe(e - GREENHOUSE.climateEnergy);
    const n = developedGame();
    n.time = CYCLE.daySeconds;
    n.power.heating = false;
    const t0 = n.plant.temp;
    for (let i = 0; i < 30; i++) tick(n, 1);
    expect(n.plant.temp).toBeLessThan(t0);
  });

  it('the harvester robot picks ready plants on its own', () => {
    const s = developedGame();
    s.levels.harvesterRobot = 1;
    s.plant.growth = 100;
    stepGreenhouse(s, 0.1, true, day);
    expect(s.stats.harvests).toBe(1);
  });
});
