import { POWER, type Circuit } from './config';
import type { GameState } from './state';

// Electrical priority: the order in which circuits get power when there is not enough for all.
// The order lives in the game state so it is saved, replayed and projected like any setting.

/** True when `order` ranks every circuit exactly once. */
export function isPriority(order: unknown): order is Circuit[] {
  return Array.isArray(order) && order.length === POWER.circuits.length &&
    POWER.circuits.every((c) => order.filter((o) => o === c).length === 1);
}

/** The order in force: the saved one when valid, the default otherwise. */
export function priorityOf(s: GameState): readonly Circuit[] {
  return isPriority(s.power.priority) ? s.power.priority : POWER.defaultPriority;
}

/** A copy of `order` with `circuit` moved one place up (-1, fed sooner) or down (+1). */
export function movePriority(order: readonly Circuit[], circuit: Circuit, dir: -1 | 1): Circuit[] {
  const out = [...order];
  const i = out.indexOf(circuit);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** 1-based rank of a circuit in the order in force. */
export function rankOf(s: GameState, circuit: Circuit): number {
  return priorityOf(s).indexOf(circuit) + 1;
}
