import { ROVER } from './config';
import { capacity } from './sim';
import type { GameState } from './state';

// Ice expedition. Craters near the lunar south pole that never see sunlight hold water ice;
// the rover scoops it up there and the base melts and filters it into drinking water.

export function scoopIce(s: GameState): number {
  const got = Math.min(ROVER.icePerScoop, ROVER.iceCargoMax - s.rover.ice);
  s.rover.ice += got;
  return got;
}

/** Unload the rover's ice at the base: it becomes water (up to storage). Returns water added. */
export function deliverIce(s: GameState): number {
  const water = Math.min(s.rover.ice * ROVER.waterPerIce, capacity(s).water - s.res.water);
  const usedIce = water / ROVER.waterPerIce;
  s.res.water += water;
  s.rover.ice -= usedIce;
  s.stats.iceDelivered += usedIce;
  return Math.round(water);
}
