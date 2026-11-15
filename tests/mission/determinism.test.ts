import { beforeAll, describe, expect, it } from 'vitest';
import type { MissionState } from '../../src/engine/types';
import {
  DESIGNS,
  canonical,
  engineAvailable,
  expectSameState,
  farmPolicy,
  loadEngine,
  runMission,
  type MissionEngine,
  type Policy,
} from './support/engine';

const suite = engineAvailable ? describe : describe.skip;

const makePolicy = (): Policy => farmPolicy({ lights: 55, reduceLightsInDarkness: true, shelterFromStorm: true });

const invalidCommands = [
  { t: 10, cmd: { type: 'setGrowLights', value: 150 } as const },
  { t: 10, cmd: { type: 'setGrowLights', value: -1 } as const },
  { t: 20, cmd: { type: 'setGrowLights', value: 150 } as const },
];

suite('determinismo por agrupación de STEP (nivel motor; runner real pendiente)', () => {
  let engine: MissionEngine;
  let reference: MissionState;

  beforeAll(async () => {
    engine = await loadEngine();
    reference = runMission(engine, DESIGNS.a(engine), {
      stepsPerFrame: 1,
      speed: 1,
      policy: makePolicy(),
      scheduled: invalidCommands,
      onFrame: (mission, api) => {
        api.summarize(mission);
        api.darknessAt(mission);
        api.nextEvent(mission);
      },
    });
  });

  for (const stepsPerFrame of [1, 4, 40]) {
    for (const speed of [1, 2] as const) {
      it(`${stepsPerFrame} paso(s) por frame a ${speed}x produce el mismo estado y resumen`, () => {
        const run = runMission(engine, DESIGNS.a(engine), {
          stepsPerFrame,
          speed,
          policy: makePolicy(),
          scheduled: invalidCommands,
          onFrame: (mission, api) => {
            api.summarize(mission);
            api.darknessAt(mission);
            api.nextEvent(mission);
          },
        });
        expectSameState(run, reference, `agrupación ${stepsPerFrame} a ${speed}x alteró el estado`);
        expect(engine.summarize(run)).toEqual(engine.summarize(reference));
        expect(canonical(run.samples)).toEqual(canonical(reference.samples));
        expect(canonical(run.events)).toEqual(canonical(reference.events));
        const rejectedLights = run.log.filter(
          (entry) =>
            !entry.ok &&
            entry.cmd.type === 'setGrowLights' &&
            (entry.cmd.value === 150 || entry.cmd.value === -1),
        );
        expect(rejectedLights.length).toBe(3);
      });
    }
  }

  it('worldStep no muta el estado después del cierre de la misión', () => {
    const before = canonical(reference);
    for (let i = 0; i < 100; i++) engine.worldStep(reference);
    expect(canonical(reference)).toEqual(before);
  });
});
