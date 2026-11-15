import { describe, expect, it } from 'vitest';
import type { Sample } from '../../engine/types';
import { newGame } from '../../game/state';
import { capacity } from '../../game/sim';
import { collectBadges, evaluateBadges, verifiedCompletion, type PassportEvidence } from './badges';

function flight(): PassportEvidence {
  const game = newGame(0);
  const cap = capacity(game);
  const final: Sample = { t: 600, o2: game.res.o2 / cap.o2 * 100, water: game.res.water / cap.water * 100,
    food: game.res.food / cap.food * 100, energy: game.res.energy / cap.energy * 100, exposure: 0, crewHealth: game.crewHealth,
    lights: 50, plantGrowth: 0, sheltered: false, isDark: false };
  return {
    game, t: 600, scenario: { id: 'mision-1', seed: 1, duration: 600, budget: 300, events: [], exposureLimit: 40, depletionGrace: 20 },
    metrics: { minLifeSupport: 50, secondsLightsReduced: 0, secondsSheltered: 0, secondsShortage: 0 },
    exposure: 0, depleted: { o2: 0, water: 0, food: 0 }, phase: 'victory', failure: null, log: [],
    events: [{ kind: 'victory', t: 600, text: 'Misión completada' }], samples: [{ ...final, t: 0 }, final],
  };
}

describe('passport result evidence', () => {
  it('unlocks completed-flight criteria; no harvest or shelter from victory alone', () => {
    const mission = flight();
    const before = structuredClone(mission);
    expect(verifiedCompletion(mission)).toBe(true);
    expect(evaluateBadges(mission).filter(badge => badge.unlocked).map(badge => badge.id)).toEqual(['mission', 'life', 'energy']);
    expect(mission).toEqual(before);
  });

  it.each(['running', 'failed'] as const)('does not award completion to %s flights', phase => {
    const mission = flight();
    mission.phase = phase;
    expect(evaluateBadges(mission).some(badge => badge.unlocked)).toBe(false);
  });

  it('rejects contradictory, incomplete, non-finite or out-of-range evidence', () => {
    const mutations: ((mission: PassportEvidence) => void)[] = [
      mission => { mission.t = 599; }, mission => { mission.exposure = 41; },
      mission => { mission.metrics.minLifeSupport = NaN; }, mission => { mission.samples = []; },
      mission => { mission.events = []; }, mission => { mission.samples.at(-1)!.energy = 99; },
      mission => { mission.game.crewHealth = 0; }, mission => { mission.metrics.secondsShortage = -1; },
      mission => { mission.depleted.water = 21; }, mission => { mission.metrics.minLifeSupport = 101; },
      mission => { mission.log = [{ t: 601, cmd: { type: 'harvest' }, ok: true }]; },
    ];
    for (const mutate of mutations) {
      const mission = flight();
      mutate(mission);
      expect(evaluateBadges(mission).some(badge => badge.unlocked)).toBe(false);
    }
  });

  it('requires matching accepted command, event and counter for a harvest', () => {
    const mission = flight();
    mission.game.stats.harvests = 1;
    mission.events.unshift({ t: 50, kind: 'harvest', text: 'Cosecha' });
    const unlocked = () => evaluateBadges(mission).find(badge => badge.id === 'harvest')!.unlocked;
    expect(unlocked()).toBe(false);
    mission.log.push({ t: 50, cmd: { type: 'harvest' }, ok: false });
    expect(unlocked()).toBe(false);
    mission.log[0].ok = true;
    expect(unlocked()).toBe(true);
  });

  it('requires shelter coverage of whole storm, not just entering once', () => {
    const mission = flight();
    mission.scenario.events.push({ kind: 'storm', warnAt: 450, startAt: 480, endAt: 540 });
    mission.events.unshift({ t: 480, kind: 'storm_start', text: 'Tormenta' }, { t: 540, kind: 'storm_end', text: 'Fin' }, { t: 480, kind: 'shelter_enter', text: 'Refugio' });
    mission.log.push({ t: 480, cmd: { type: 'enterShelter' }, ok: true }, { t: 500, cmd: { type: 'leaveShelter' }, ok: true });
    mission.metrics.secondsSheltered = 60;
    const unlocked = () => evaluateBadges(mission).find(badge => badge.id === 'shelter')!.unlocked;
    expect(unlocked()).toBe(false);
    mission.log[1].t = 540;
    expect(unlocked()).toBe(true);
    mission.log[0].ok = false;
    expect(unlocked()).toBe(false);
  });

  it('keeps earned badges across provided flights; empty history remains locked', () => {
    expect(collectBadges([]).every(badge => !badge.unlocked)).toBe(true);
    const failed = flight();
    failed.phase = 'failed';
    expect(collectBadges([flight(), failed]).filter(badge => badge.unlocked)).toHaveLength(3);
  });
});
