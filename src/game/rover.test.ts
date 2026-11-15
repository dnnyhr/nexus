import { describe, expect, it } from 'vitest';
import { ROVER } from './config';
import { deliverIce, scoopIce } from './rover';
import { developedGame } from './testing';

describe('ice expedition', () => {
  it('scoops ice up to the cargo limit', () => {
    const s = developedGame();
    scoopIce(s);
    scoopIce(s);
    expect(scoopIce(s)).toBe(0);
    expect(s.rover.ice).toBe(ROVER.iceCargoMax);
  });

  it('delivered ice becomes water and counts for the mission', () => {
    const s = developedGame();
    s.res.water = 10;
    scoopIce(s);
    const added = deliverIce(s);
    expect(added).toBe(ROVER.icePerScoop);
    expect(s.res.water).toBe(10 + ROVER.icePerScoop);
    expect(s.stats.iceDelivered).toBe(ROVER.icePerScoop);
    expect(s.rover.ice).toBe(0);
  });
});
