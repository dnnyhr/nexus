import { fixedStepClock, type FixedStepOptions } from '../game/loop';
import { applyCommand } from './commands';
import { STEP, type Command, type CommandResult, type MissionState } from './types';
import { worldStep } from './world';

// The only place a running mission advances or receives player actions. The render loop calls
// advance() with real frame time; inputs call dispatch(). Pause, overlays and speed live here,
// outside MissionState, so they can never change what the simulation computes.

export type MissionSpeed = 1 | 2;

export interface MissionRunner {
  readonly mission: MissionState;
  /** Real pause: no steps, no economic actions. */
  paused: boolean;
  speed: MissionSpeed;
  /** An overlay (commander, report) owns the screen: no steps, no actions from the 3D world. */
  blocked: boolean;
  /** True when player actions from the world would be accepted right now. */
  canDispatch(): boolean;
  /** Feed one real frame. Returns how many fixed steps ran (0 while paused, blocked or closed). */
  advance(realSeconds: number): number;
  /** A player action from the world. Refused without touching the state or the log while paused, blocked or closed. */
  dispatch(cmd: Command): CommandResult;
  /** The commander's confirmed plan: applied now, even while paused, in order, all logged. */
  confirm(plan: Command[]): CommandResult[];
}

const refused = (reason: string): CommandResult => ({ ok: false, reason });

export function createMissionRunner(mission: MissionState, opts: FixedStepOptions = {}): MissionRunner {
  const clock = fixedStepClock(STEP, opts);
  let paused = false;
  let blocked = false;
  let speed: MissionSpeed = 1;
  const runner: MissionRunner = {
    mission,
    get paused() { return paused; },
    set paused(v: boolean) { paused = v; clock.reset(); },
    get blocked() { return blocked; },
    set blocked(v: boolean) { blocked = v; clock.reset(); },
    get speed() { return speed; },
    set speed(v: MissionSpeed) { speed = v === 2 ? 2 : 1; },
    canDispatch: () => !paused && !blocked && mission.phase === 'running',
    advance(realSeconds) {
      if (paused || blocked || mission.phase !== 'running') return 0;
      return clock.advance(realSeconds, () => {
        worldStep(mission);
        return mission.phase === 'running';
      }, speed);
    },
    dispatch(cmd) {
      if (mission.phase !== 'running') return refused('Misión terminada');
      if (paused) return refused('Misión en pausa');
      if (blocked) return refused('Cierra el panel para operar');
      return applyCommand(mission, cmd);
    },
    confirm(plan) {
      return plan.map((cmd) => applyCommand(mission, cmd));
    },
  };
  return runner;
}
