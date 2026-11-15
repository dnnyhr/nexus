import { MISSION } from '../game/config';
import { adjustClimate, harvest, irrigate } from '../game/sim';
import { recordChange } from './ledger';
import { figure, updateMinimum } from './observation';
import type { MissionCause, MissionState } from './types';

// Greenhouse automation as a rule of the mission world: it runs inside worldStep, so play,
// projection and replay all apply it the same way. Its actions are not player commands.

export function crewRoutine(ms: MissionState): void {
  const rules = MISSION.routine;
  const s = ms.game;
  if (!rules.enabled || ms.t % rules.every !== 0 || s.sheltered || s.plant.dead || s.levels.greenhouse === 0) return;
  const act = (cause: MissionCause, run: () => unknown) => {
    const before = { ...s.res };
    run();
    recordChange(ms, before, cause);
  };
  if (s.plant.water <= rules.waterBelow) act('irrigation', () => irrigate(s));
  if (s.plant.temp < rules.tempMin) act('climate', () => adjustClimate(s, 1));
  else if (s.plant.temp > rules.tempMax) act('climate', () => adjustClimate(s, -1));
  if (s.plant.growth >= 100) {
    const food = s.res.food;
    act('harvest', () => harvest(s));
    if (s.stats.harvests > 0 && s.plant.growth === 0) {
      ms.events.push({ t: ms.t, kind: 'harvest', text: `Cosecha ${s.stats.harvests} (rutina automática): +${figure(s.res.food - food)} alimento almacenado` });
    }
  }
  updateMinimum(ms);
}
