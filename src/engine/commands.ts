import { POWER } from '../game/config';
import { isPriority } from '../game/power';
import { adjustClimate, collectByHand, deliverRegolith, harvest, irrigate, replant } from '../game/sim';
import type { GameState } from '../game/state';
import { recordChange } from './ledger';
import { figure, updateMinimum } from './observation';
import type { Command, CommandResult, MissionCause, MissionState } from './types';

const rejected = (reason: string): CommandResult => ({ ok: false, reason });

function serializableCommand(cmd: Command): Command {
  try {
    return JSON.parse(JSON.stringify(cmd));
  } catch {
    return { type: 'invalid' } as unknown as Command;
  }
}

export function applyToGame(s: GameState, cmd: Command): CommandResult {
  if (!cmd || typeof cmd !== 'object') return rejected('Comando inválido');
  switch (cmd.type) {
    case 'setGrowLights':
      if (!Number.isFinite(cmd.value) || cmd.value < 0 || cmd.value > 100) return rejected('Luces fuera de rango');
      s.power.growLights = cmd.value;
      return { ok: true };
    case 'setPower':
      if ((cmd.system as string) === 'lifeSupport') return rejected('Soporte vital es carga crítica: no se desconecta; cambia su prioridad');
      if (!POWER.switchable.includes(cmd.system) || typeof cmd.on !== 'boolean') return rejected('Sistema inválido');
      s.power[cmd.system as 'heating' | 'processor' | 'robots' | 'greenhouse'] = cmd.on;
      return { ok: true };
    case 'setPriority':
      if (!isPriority(cmd.order)) return rejected('Prioridad inválida: ordena los cinco circuitos sin repetir');
      s.power.priority = [...cmd.order];
      return { ok: true };
    case 'enterShelter':
      if (s.sheltered) return rejected('Ya estás en refugio');
      s.sheltered = true;
      return { ok: true };
    case 'leaveShelter':
      if (!s.sheltered) return rejected('Ya estás fuera del refugio');
      s.sheltered = false;
      return { ok: true };
    case 'irrigate': return irrigate(s) ? { ok: true } : rejected('Sin agua suficiente o planta muerta');
    case 'adjustClimate':
      if (cmd.dir !== 1 && cmd.dir !== -1) return rejected('Dirección de clima inválida');
      return adjustClimate(s, cmd.dir) ? { ok: true } : rejected('Sin energía suficiente o planta muerta');
    case 'harvest': return harvest(s) > 0 ? { ok: true } : rejected('Cultivo no listo');
    case 'replant': return replant(s) ? { ok: true } : rejected('Sin materiales o planta viva');
    case 'collectRegolith':
      if (s.sheltered) return rejected('No se puede cavar en refugio');
      return collectByHand(s) > 0 ? { ok: true } : rejected('Bolsa llena');
    case 'deliverRegolith':
      if (s.sheltered) return rejected('No se puede entregar en refugio');
      return deliverRegolith(s) > 0 ? { ok: true } : rejected('Sin procesador, carga o espacio');
    default: return rejected('Comando desconocido');
  }
}

export function applyCommand(ms: MissionState, cmd: Command): CommandResult {
  const before = { ...ms.game.res };
  let result: CommandResult;
  if (ms.phase !== 'running') result = rejected('Misión terminada');
  else if (ms.game.sheltered && ['irrigate', 'adjustClimate', 'harvest', 'replant', 'collectRegolith', 'deliverRegolith'].includes(cmd?.type)) result = rejected('Acción suspendida en refugio');
  else result = applyToGame(ms.game, cmd);
  ms.log.push({ t: ms.t, cmd: serializableCommand(cmd), ok: result.ok });
  if (result.ok) {
    const cause: MissionCause = cmd.type === 'harvest' ? 'harvest' : cmd.type === 'irrigate' ? 'irrigation' : 'climate';
    recordChange(ms, before, cause);
    updateMinimum(ms);
    if (cmd.type === 'harvest') ms.events.push({ t: ms.t, kind: 'harvest', text: `Cosecha ${ms.game.stats.harvests}: +${figure(ms.game.res.food - before.food)} alimento almacenado; soporte mínimo ${figure(ms.metrics.minLifeSupport)} %` });
    if (cmd.type === 'enterShelter' || cmd.type === 'leaveShelter') ms.events.push({ t: ms.t, kind: cmd.type === 'enterShelter' ? 'shelter_enter' : 'shelter_leave', text: cmd.type === 'enterShelter' ? 'Entrada en refugio' : 'Salida del refugio' });
  }
  return result;
}
