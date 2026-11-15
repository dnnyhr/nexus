import { applyCommand } from './commands';
import { startMission } from './design';
import { SCENARIO_1 } from './mission1';
import { STEP, type Design, type LoggedCommand, type MissionState } from './types';
import { worldStep } from './world';

export function replay(design: Design, log: LoggedCommand[], until: number, scenario = SCENARIO_1): MissionState {
  if (!Number.isFinite(until) || until < 0 || until > scenario.duration || !Number.isInteger(until / STEP)) throw new Error('Tiempo de replay inválido');
  let previous = 0;
  for (const entry of log) {
    if (!Number.isFinite(entry.t) || entry.t < previous || entry.t > scenario.duration || !Number.isInteger(entry.t / STEP) || typeof entry.ok !== 'boolean') throw new Error('Log de replay inválido');
    previous = entry.t;
  }
  const ms = startMission(design, scenario);
  let index = 0;
  while (true) {
    while (index < log.length && log[index].t === ms.t) {
      const entry = log[index++];
      if (applyCommand(ms, entry.cmd).ok !== entry.ok) throw new Error('Resultado de comando no coincide con replay');
    }
    if (ms.t >= until || ms.phase !== 'running') break;
    worldStep(ms);
  }
  return ms;
}
