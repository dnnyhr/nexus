import { describe, expect, it } from 'vitest';
import { capacity } from '../game/sim';
import { applyCommand, emptyDesign, MISSION_RULES, startMission, worldStep } from './index';
import type { MissionState } from './types';

function expectClosure(ms: MissionState, before: MissionState): void {
  for (const r of ['o2', 'water', 'food', 'energy'] as const) {
    const delta = Object.values(ms.ledger[r]).reduce((sum, v) => sum + v, 0) - Object.values(before.ledger[r]).reduce((sum, v) => sum + v, 0);
    expect(delta).toBeCloseTo(ms.game.res[r] - before.game.res[r], 8);
  }
}

describe('causal ledger', () => {
  it('attributes uncapped crew, processor and power deltas without residual storage', () => {
    const ms = startMission({ ...emptyDesign(), processor: 1, batteries: 1 });
    ms.game.res.regolith = 10;
    const before = structuredClone(ms);
    worldStep(ms);
    expectClosure(ms, before);
    expect(ms.ledger.o2.crew).toBeCloseTo(-0.07 * 0.25);
    expect(ms.ledger.o2.processor).toBeCloseTo(0.5 * 0.42 * 0.25);
    expect(ms.ledger.energy.solar).toBeCloseTo(3.6 * 0.25);
    expect(ms.ledger.energy.processor).toBeCloseTo(-1.2 * 0.25);
    expect(ms.ledger.energy.lights).toBeCloseTo(-0.45 * 0.25);
    for (const r of ['o2', 'water', 'food', 'energy'] as const) expect(ms.ledger[r].storage).toBeCloseTo(0, 10);
  });

  it('closes intervals containing commands, darkness, saturation, shelter and harvests', () => {
    MISSION_RULES.routine.enabled = false;
    try {
      closesIntervals();
    } finally {
      MISSION_RULES.routine.enabled = true;
    }
  });

  it('attributes the automated greenhouse routine to irrigation and climate and still closes', () => {
    const ms = startMission({ ...emptyDesign(), batteries: 1 });
    const initial = structuredClone(ms);
    for (let i = 0; i < 1600 && ms.phase === 'running'; i++) {
      const before = structuredClone(ms);
      worldStep(ms);
      expectClosure(ms, before);
    }
    expectClosure(ms, initial);
    expect(ms.ledger.water.irrigation).toBeLessThan(0);
    expect(ms.log).toHaveLength(0);
  });
});

function closesIntervals(): void {
  {
    const ms = startMission({ ...emptyDesign(), greenhouse: 2, batteries: 1, processor: 1 });
    ms.game.res.energy = capacity(ms.game).energy;
    const initial = structuredClone(ms);
    for (let i = 0; i < 2000 && ms.phase === 'running'; i++) {
      const before = structuredClone(ms);
      if (i === 40) applyCommand(ms, { type: 'adjustClimate', dir: -1 });
      if (i === 80) applyCommand(ms, { type: 'irrigate' });
      if (i === 850) applyCommand(ms, { type: 'harvest' });
      if (i === 1200) applyCommand(ms, { type: 'enterShelter' });
      if (i === 1500) applyCommand(ms, { type: 'leaveShelter' });
      worldStep(ms);
      expectClosure(ms, before);
    }
    expectClosure(ms, initial);
    expect(ms.ledger.energy.storage).toBeLessThan(0);
    expect(ms.ledger.energy.shelter).toBeLessThan(0);
    expect(ms.ledger.water.irrigation).toBe(-2);
    expect(ms.ledger.energy.climate).toBe(-3);
  }
}

describe('causal ledger (continued)', () => {

  it('records actual stored harvest instead of nominal yield at capacity', () => {
    const ms = startMission(emptyDesign());
    ms.game.plant.growth = 100;
    ms.game.res.food = capacity(ms.game).food - 1;
    const before = structuredClone(ms);
    expect(applyCommand(ms, { type: 'harvest' }).ok).toBe(true);
    expect(ms.ledger.food.harvest).toBe(1);
    expectClosure(ms, before);
    expect(ms.events.at(-1)?.text).toContain('+1 alimento');
  });
});
