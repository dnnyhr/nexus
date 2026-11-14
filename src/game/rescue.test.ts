import { describe, expect, it } from 'vitest';
import { RESCUE } from './config';
import { canImpact, impact } from './damage';
import { stepRescue } from './rescue';
import { step } from './sim';
import { developedGame } from './testing';

describe('a base never gets stuck', () => {
  it('a crew out of oxygen with everything broken gets a supply drop and recovers', () => {
    const s = developedGame();
    s.res = { ...s.res, o2: 0, water: 0, food: 0, energy: 0, materials: 0, regolith: 0 };
    s.crewHealth = 0;
    s.damage = { processor: 1, 'solarMast:0': 1, 'solarMast:1': 1 };
    expect(stepRescue(s, 1)).toBe(true);
    expect(s.crewHealth).toBeGreaterThanOrEqual(RESCUE.healthAfter);
    expect(s.res.o2).toBeGreaterThan(0);
    expect(s.res.materials).toBe(RESCUE.materials);
    // With health back, production runs again.
    s.res.regolith = 10;
    step(s, 1);
    expect(s.res.regolith).toBeLessThan(10);
  });

  it('drops are not sent again right away', () => {
    const s = developedGame();
    s.crewHealth = 0;
    stepRescue(s, 1);
    s.crewHealth = 0;
    expect(stepRescue(s, 1)).toBe(false);
    expect(stepRescue(s, RESCUE.cooldown)).toBe(true);
  });

  it('a healthy crew needs no rescue', () => {
    expect(stepRescue(developedGame(), 1)).toBe(false);
  });

  it('impacts pause while two buildings are badly damaged', () => {
    const s = developedGame();
    s.damage = { processor: 0.8, station: 0.6 };
    expect(canImpact(s)).toBe(false);
    expect(impact(s)).toBeNull();
  });
});
