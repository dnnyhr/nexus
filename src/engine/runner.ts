import { fixedStepClock, type FixedStepOptions } from '../game/loop';
import { applyCommand } from './commands';
import { STEP, type Command, type CommandResult, type MissionState } from './types';
import { worldStep } from './world';

// The only place a running mission advances or receives player actions. The render loop calls
// advance() with real frame time; inputs call dispatch(). Pause, overlays and speed live here,
// outside MissionState, so they can never change what the simulation computes.

export type MissionSpeed = 1 | 2 | 4;
export const MISSION_SPEEDS: readonly MissionSpeed[] = [1, 2, 4];

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
  /** Next scenario boundary (warning, start or end of an event) or the end of the mission. */
  nextStop(): number;
  /**
   * Skip quiet time: run the same fixed steps up to nextStop() at once. Nothing is skipped in the
   * simulation, only waiting. Refused while paused, blocked or closed. Returns the steps run.
   */
  skipToNextStop(): number;
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
    set speed(v: MissionSpeed) { speed = MISSION_SPEEDS.includes(v) ? v : 1; },
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
    nextStop() {
      const t = mission.t;
      const stops = mission.scenario.events.flatMap((e) => [e.warnAt, e.startAt, e.endAt]).filter((at) => at > t);
      return Math.min(mission.scenario.duration, ...stops);
    },
    skipToNextStop() {
      if (paused || blocked || mission.phase !== 'running') return 0;
      const until = runner.nextStop();
      let ran = 0;
      while (mission.t < until && mission.phase === 'running') {
        worldStep(mission);
        ran++;
      }
      clock.reset();
      return ran;
    },
  };
  return runner;
}
