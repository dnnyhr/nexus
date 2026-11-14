import { RESCUE } from './config';
import { capacity } from './sim';
import type { GameState } from './state';

// Emergency supply drop. NEXUS is a tycoon: the base never resets and the player never
// "loses". If the crew is in danger (everything broken, no power, out of oxygen), Mission
// Control sends a cargo pod with supplies and a few materials so the player can recover
// and learn from it. It can repeat, but not too often.

export function needsRescue(s: GameState): boolean {
  return s.crewHealth < RESCUE.healthThreshold && s.rescue.cooldown <= 0;
}

/** Count down the cooldown; when the crew is in danger, deliver the drop. Returns true if sent. */
export function stepRescue(s: GameState, dt: number): boolean {
  s.rescue.cooldown = Math.max(0, s.rescue.cooldown - dt);
  if (!needsRescue(s)) return false;
  const cap = capacity(s);
  s.res.o2 = Math.max(s.res.o2, cap.o2 * RESCUE.refill);
  s.res.water = Math.max(s.res.water, cap.water * RESCUE.refill);
  s.res.food = Math.max(s.res.food, cap.food * RESCUE.refill);
  s.res.energy = Math.max(s.res.energy, cap.energy * RESCUE.refill);
  s.res.materials += RESCUE.materials;
  s.crewHealth = Math.max(s.crewHealth, RESCUE.healthAfter);
  s.rescue.cooldown = RESCUE.cooldown;
  s.rescue.count += 1;
  return true;
}
