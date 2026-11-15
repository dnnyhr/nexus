import type { MissionCause, MissionLedger, MissionResource, MissionState } from './types';

export const RESOURCES: MissionResource[] = ['o2', 'water', 'food', 'energy'];
const CAUSES: MissionCause[] = ['crew', 'processor', 'lights', 'heating', 'shelter', 'harvest', 'solar', 'irrigation', 'climate', 'storage'];

export function emptyLedger(): MissionLedger {
  return Object.fromEntries(RESOURCES.map(r => [r, Object.fromEntries(CAUSES.map(c => [c, 0]))])) as MissionLedger;
}

export function recordChange(ms: MissionState, before: Record<MissionResource, number>, cause: MissionCause): void {
  for (const r of RESOURCES) ms.ledger[r][cause] += ms.game.res[r] - before[r];
}
