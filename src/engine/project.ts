import { applyCommand } from './commands';
import { sample } from './observation';
import { STEP, type Command, type Horizon, type MissionState, type Projection } from './types';
import { worldStep } from './world';

export function project(ms: MissionState, plan: Command[], horizon: Horizon): Projection {
  let until: number;
  switch (horizon.kind) {
    case 'seconds':
      if (!Number.isFinite(horizon.value) || horizon.value < 0 || !Number.isInteger(horizon.value / STEP)) throw new Error('Horizonte inválido: debe ser finito, no negativo y alineado a STEP');
      until = Math.min(ms.scenario.duration, ms.t + horizon.value);
      break;
    case 'endOfDarkness':
      until = ms.scenario.events.filter(e => e.kind === 'darkness' && e.endAt > ms.t).sort((a, b) => a.endAt - b.endAt)[0]?.endAt ?? ms.scenario.duration;
      break;
    case 'endOfMission': until = ms.scenario.duration; break;
    default: throw new Error('Horizonte desconocido');
  }
  const clone = structuredClone(ms);
  const eventStart = clone.events.length;
  const rejected: Projection['rejected'] = [];
  for (const cmd of plan) {
    const result = applyCommand(clone, cmd);
    if (!result.ok) rejected.push({ cmd: structuredClone(cmd), reason: result.reason! });
  }
  clone.samples = [sample(clone)];
  while (clone.t < until && clone.phase === 'running') worldStep(clone);
  if (clone.samples.at(-1)?.t !== clone.t) clone.samples.push(sample(clone));
  return { until: clone.t, samples: clone.samples, events: clone.events.slice(eventStart), phase: clone.phase, failure: clone.failure, rejected };
}
