import { SCENARIO_1 } from './mission1';
import { startMission } from './design';
import { applyCommand } from './commands';
import { makeSample, worldStep } from './world';
import { STEP, type Command, type Design, type Horizon, type LoggedCommand, type MissionState, type Projection, type Scenario } from './types';

const EPS = 1e-9;

function horizonEnd(ms: MissionState, h: Horizon): number {
  const sc = ms.scenario;
  if (h.kind === 'endOfMission') return sc.duration;
  if (h.kind === 'endOfDarkness') {
    const dark = sc.events.find((e) => e.kind === 'darkness' && e.endAt > ms.t + EPS);
    return dark ? dark.endAt : ms.t;
  }
  if (!Number.isFinite(h.value) || h.value < 0) throw new Error('Horizonte no válido.');
  return Math.min(sc.duration, ms.t + h.value);
}

/**
 * What happens if the plan is applied now and nobody does anything else until the horizon.
 * Works on a copy: the mission itself is not changed.
 */
export function project(ms: MissionState, plan: Command[], horizon: Horizon): Projection {
  const c: MissionState = structuredClone(ms);
  const until = horizonEnd(c, horizon);
  const events0 = c.events.length;
  const rejected: Projection['rejected'] = [];
  for (const cmd of plan) {
    const r = applyCommand(c, cmd);
    if (!r.ok) rejected.push({ cmd, reason: r.reason ?? '' });
  }
  const samples0 = c.samples.length;
  const first = makeSample(c);
  while (c.phase === 'running' && c.t < until - EPS) worldStep(c);
  return {
    until: c.t,
    samples: [first, ...c.samples.slice(samples0).filter((s) => s.t > first.t)],
    events: c.events.slice(events0),
    phase: c.phase,
    failure: c.failure,
    rejected,
  };
}

/** Rebuild a mission from its design and command log, up to `until` (a multiple of STEP). */
export function replay(design: Design, log: LoggedCommand[], until: number, scenario: Scenario = SCENARIO_1): MissionState {
  if (!Number.isFinite(until) || until < 0) throw new Error('Tiempo de replay no válido.');
  if (Math.abs(until / STEP - Math.round(until / STEP)) > 1e-6) throw new Error(`El tiempo de replay debe ser múltiplo de ${STEP} s.`);
  const ms = startMission(design, scenario);
  let i = 0;
  for (;;) {
    while (i < log.length && log[i].t <= ms.t + EPS) applyCommand(ms, log[i++].cmd);
    if (ms.phase !== 'running' || ms.t >= until - EPS) break;
    worldStep(ms);
  }
  return ms;
}
