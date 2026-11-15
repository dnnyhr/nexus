import { describe, expect, it } from 'vitest';
import { createMissionRunner, emptyDesign, startMission, STEP, summarize, type Command, type Design } from './index';

const DESIGN: Design = { ...emptyDesign(), solarMasts: 1, shield: 1, reserves: { o2: 1, water: 1, food: 0 } };

// Commands at whole 10 s so every frame grouping tested has a frame boundary there.
const SCHEDULE: { t: number; cmd: Command }[] = [
  { t: 100, cmd: { type: 'irrigate' } },
  { t: 190, cmd: { type: 'harvest' } },
  { t: 200, cmd: { type: 'irrigate' } },
  { t: 240, cmd: { type: 'setPriority', order: ['lifeSupport', 'greenhouse', 'heating', 'processor', 'robots'] } },
  { t: 250, cmd: { type: 'setGrowLights', value: 40 } },
  { t: 300, cmd: { type: 'adjustClimate', dir: 1 } },
  { t: 420, cmd: { type: 'setPriority', order: ['lifeSupport', 'heating', 'processor', 'robots', 'greenhouse'] } },
  { t: 480, cmd: { type: 'enterShelter' } },
  { t: 500, cmd: { type: 'irrigate' } },
  { t: 540, cmd: { type: 'leaveShelter' } },
];

function play(stepsPerFrame: number, speed: 1 | 2, pauseEvery = 0) {
  const runner = createMissionRunner(startMission(DESIGN), { maxFrame: 1000, maxSteps: 1000 });
  runner.speed = speed;
  const frame = (stepsPerFrame * STEP) / speed;
  let next = 0;
  let frames = 0;
  while (runner.mission.phase === 'running') {
    while (next < SCHEDULE.length && SCHEDULE[next].t === runner.mission.t) runner.dispatch(SCHEDULE[next++].cmd);
    if (pauseEvery && ++frames % pauseEvery === 0) {
      runner.paused = true;
      const before = JSON.stringify(runner.mission);
      expect(runner.advance(frame)).toBe(0);
      expect(runner.dispatch({ type: 'irrigate' })).toEqual({ ok: false, reason: 'Misión en pausa' });
      expect(JSON.stringify(runner.mission)).toBe(before);
      runner.paused = false;
    }
    runner.advance(frame);
  }
  return runner.mission;
}

describe('mission runner', () => {
  it('frame grouping and speed do not change the result for the same commands at the same times', () => {
    const reference = play(1, 1);
    expect(reference.phase).toBe('victory');
    expect(reference.log).toHaveLength(SCHEDULE.length);
    for (const [steps, speed] of [[4, 1], [40, 1], [1, 2], [4, 2], [40, 2]] as const) {
      const other = play(steps, speed);
      expect(other).toEqual(reference);
      expect(summarize(other)).toEqual(summarize(reference));
    }
  });

  it('pausing many times changes nothing: no steps, no actions, no log entries', () => {
    expect(play(4, 1, 3)).toEqual(play(4, 1));
  });

  it('an open overlay blocks world actions but the commander plan still applies, logged in order', () => {
    const runner = createMissionRunner(startMission(emptyDesign()));
    runner.blocked = true;
    expect(runner.canDispatch()).toBe(false);
    expect(runner.advance(0.1)).toBe(0);
    expect(runner.dispatch({ type: 'setGrowLights', value: 10 }).ok).toBe(false);
    expect(runner.mission.log).toHaveLength(0);
    const results = runner.confirm([{ type: 'setGrowLights', value: 30 }, { type: 'leaveShelter' }]);
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(runner.mission.log.map((e) => [e.t, e.cmd.type, e.ok])).toEqual([[0, 'setGrowLights', true], [0, 'leaveShelter', false]]);
    expect(runner.mission.game.power.growLights).toBe(30);
    runner.blocked = false;
    expect(runner.canDispatch()).toBe(true);
  });

  it('a closed mission neither advances nor takes actions', () => {
    const runner = createMissionRunner(startMission(emptyDesign()), { maxFrame: 1000, maxSteps: 100000 });
    runner.advance(1000);
    expect(runner.mission.phase).not.toBe('running');
    const t = runner.mission.t;
    const logged = runner.mission.log.length;
    expect(runner.advance(10)).toBe(0);
    expect(runner.dispatch({ type: 'irrigate' }).ok).toBe(false);
    expect(runner.mission.t).toBe(t);
    expect(runner.mission.log).toHaveLength(logged);
  });

  it('stops stepping in the frame where the mission ends', () => {
    const runner = createMissionRunner(startMission(emptyDesign()), { maxFrame: 1000, maxSteps: 100000 });
    const ran = runner.advance(1000);
    expect(ran).toBe(runner.mission.t / STEP);
  });

  it('only accepts 1x or 2x', () => {
    const runner = createMissionRunner(startMission(emptyDesign()));
    runner.speed = 3 as never;
    expect(runner.speed).toBe(1);
    runner.speed = 2;
    expect(runner.speed).toBe(2);
  });
});
