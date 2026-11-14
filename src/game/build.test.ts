import { describe, expect, it } from 'vitest';
import { build, checkBuild, nextCost } from './build';
import { COSTS, MAX_LEVEL } from './config';
import { capacity } from './sim';
import { newGame } from './state';

describe('building and upgrading', () => {
  it('upgrading spends materials and raises the level', () => {
    const s = newGame();
    s.res.materials = 500;
    expect(build(s, 'station')).toBe(true);
    expect(s.levels.station).toBe(2);
    expect(s.res.materials).toBe(500 - COSTS.station[1]);
  });

  it('a bigger station stores more', () => {
    const s = newGame();
    const before = capacity(s).o2;
    s.res.materials = 500;
    build(s, 'station');
    expect(capacity(s).o2).toBeGreaterThan(before);
  });

  it('not enough materials: nothing changes and the reason is reported', () => {
    const s = newGame();
    s.res.materials = 10;
    expect(checkBuild(s, 'solarMast')).toMatchObject({ ok: false, reason: 'materials' });
    expect(build(s, 'solarMast')).toBe(false);
    expect(s.counts.solarMast).toBe(2);
    expect(s.res.materials).toBe(10);
  });

  it('stops at the maximum level', () => {
    const s = newGame();
    s.levels.station = MAX_LEVEL.station;
    expect(nextCost(s, 'station')).toBeNull();
    expect(checkBuild(s, 'station')).toMatchObject({ ok: false, reason: 'max' });
  });

  it('solar masts and batteries are built as more units', () => {
    const s = newGame();
    s.res.materials = 1000;
    build(s, 'battery');
    build(s, 'battery');
    expect(s.counts.battery).toBe(2);
    expect(capacity(s).energy).toBeGreaterThan(newGame().res.energy);
  });

  it('collector robots cannot outgrow the station level', () => {
    const s = newGame();
    s.res.materials = 1000;
    expect(build(s, 'collectorRobot')).toBe(true);
    expect(checkBuild(s, 'collectorRobot')).toMatchObject({ ok: false, reason: 'requires', requires: 'station' });
  });
});
