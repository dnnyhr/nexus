import { adjustClimate, collectByHand, deliverRegolith, harvest, irrigate, replant } from '../game/sim';
import type { GameState } from '../game/state';
import { emit } from './world';
import type { Command, CommandResult, MissionState } from './types';

const no = (reason: string): CommandResult => ({ ok: false, reason });
const yes: CommandResult = { ok: true };

/** Apply a player action to a game, with free-mode meaning (no log). */
export function applyToGame(s: GameState, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'setGrowLights': {
      if (typeof cmd.value !== 'number' || !Number.isFinite(cmd.value)) return no('Brillo no válido.');
      s.power.growLights = Math.round(Math.min(100, Math.max(0, cmd.value)));
      return yes;
    }
    case 'setPower':
      if (!['heating', 'processor', 'robots'].includes(cmd.system)) return no('Sistema desconocido.');
      s.power[cmd.system] = !!cmd.on;
      return yes;
    case 'irrigate':
      if (s.plant.dead) return no('La planta está muerta: hay que replantar.');
      return irrigate(s) ? yes : no('No hay agua suficiente para regar.');
    case 'adjustClimate':
      if (s.plant.dead) return no('La planta está muerta: hay que replantar.');
      return adjustClimate(s, cmd.dir === -1 ? -1 : 1) ? yes : no('No hay energía suficiente para el clima.');
    case 'harvest':
      return harvest(s) > 0 ? yes : no(s.plant.dead ? 'La planta está muerta.' : 'La planta todavía no está lista.');
    case 'replant':
      return replant(s) ? yes : no(s.plant.dead ? 'Faltan materiales para replantar.' : 'La planta está viva: no hace falta replantar.');
    case 'enterShelter':
      if (s.sheltered) return no('Ya estás en el refugio.');
      s.sheltered = true;
      return yes;
    case 'leaveShelter':
      if (!s.sheltered) return no('No estás en el refugio.');
      s.sheltered = false;
      return yes;
    case 'collectRegolith':
      if (s.sheltered) return no('Desde el refugio no se puede excavar.');
      return collectByHand(s) > 0 ? yes : no('La bolsa está llena.');
    case 'deliverRegolith':
      if (s.levels.processor === 0) return no('No hay procesador.');
      if (s.carried <= 0) return no('La bolsa está vacía.');
      return deliverRegolith(s) > 0 ? yes : no('El procesador está lleno.');
    default:
      return no('Comando desconocido.');
  }
}

const OUTSIDE_WORK: Command['type'][] = ['irrigate', 'adjustClimate', 'harvest', 'replant', 'collectRegolith', 'deliverRegolith'];

/** Apply a player action to the mission: validated, applied and logged at mission time. */
export function applyCommand(ms: MissionState, cmd: Command): CommandResult {
  let result: CommandResult;
  if (ms.phase !== 'running') result = no('La misión terminó.');
  else if (ms.game.sheltered && OUTSIDE_WORK.includes(cmd.type)) result = no('Desde el refugio no se puede atender la base: sal primero.');
  else {
    const food = ms.game.res.food;
    result = applyToGame(ms.game, cmd);
    if (result.ok && cmd.type === 'harvest') emit(ms, 'harvest', `Cosecha: +${Math.round(ms.game.res.food - food)} de comida.`);
    if (result.ok && cmd.type === 'enterShelter') emit(ms, 'shelter_enter', 'Entraste al refugio: el cultivo y el procesador se detienen.');
    if (result.ok && cmd.type === 'leaveShelter') emit(ms, 'shelter_leave', 'Saliste del refugio.');
  }
  ms.log.push({ t: ms.t, cmd: structuredClone(cmd), ok: result.ok });
  return result;
}
