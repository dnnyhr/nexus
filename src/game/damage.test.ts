import { describe, expect, it } from 'vitest';
import { builtKeys, impact, impactChance, repair, repairCost } from './damage';
import { capacity, resolvePower } from './sim';
import { newGame } from './state';
import { developedGame } from './testing';

describe('micrometeoroid damage', () => {
  it('nothing to hit before anything is built', () => {
    expect(impact(newGame())).toBeNull();
  });

  it('an impact damages a built structure', () => {
    const s = developedGame();
    const key = impact(s, () => 0)!;
    expect(builtKeys(s)).toContain(key);
    expect(s.damage[key]).toBeGreaterThan(0.3);
  });

  it('a damaged solar mast makes less power', () => {
    const a = developedGame();
    const b = developedGame();
    b.damage['solarMast:0'] = 1;
    expect(resolvePower(b, 1, true).generation).toBeLessThan(resolvePower(a, 1, true).generation);
  });

  it('a damaged battery stores less', () => {
    const a = developedGame();
    a.counts.battery = 1;
    const b = developedGame();
    b.counts.battery = 1;
    b.damage['battery:0'] = 1;
    expect(capacity(b).energy).toBeLessThan(capacity(a).energy);
  });

  it('repairing costs materials and clears the damage', () => {
    const s = developedGame();
    s.damage.processor = 0.5;
    const cost = repairCost(s, 'processor');
    const mat = s.res.materials;
    expect(repair(s, 'processor')).toBe(true);
    expect(s.res.materials).toBe(mat - cost);
    expect(s.damage.processor).toBeUndefined();
  });

  it('meteor showers make impacts more likely', () => {
    expect(impactChance(1, 1)).toBeGreaterThan(impactChance(1, 0));
  });
});
