import { describe, expect, it } from 'vitest';
import { build } from './build';
import { advanceMission, currentMission, MISSIONS, unlocked } from './missions';
import { collectByHand } from './sim';
import { newGame } from './state';

describe('missions', () => {
  it('starts with the antenna, and only the antenna can be built', () => {
    const s = newGame();
    expect(currentMission(s).id).toBe('antenna');
    expect([...unlocked(s)]).toEqual(['antenna']);
    expect(build(s, 'antenna')).toBe(true);
  });

  it('completing a mission gives its reward and moves on', () => {
    const s = newGame();
    build(s, 'antenna');
    const mat = s.res.materials;
    const done = advanceMission(s);
    expect(done?.id).toBe('antenna');
    expect(s.res.materials).toBe(mat + MISSIONS[0].reward);
    expect(currentMission(s).id).toBe('dig');
  });

  it('does not advance until the goal is met', () => {
    const s = newGame();
    expect(advanceMission(s)).toBeNull();
    expect(s.mission).toBe(0);
  });

  it('the early chain is affordable without getting stuck', () => {
    const s = newGame();
    build(s, 'antenna');
    advanceMission(s);
    for (let i = 0; i < 3; i++) collectByHand(s);
    advanceMission(s);
    expect(currentMission(s).id).toBe('processor');
    expect(build(s, 'processor')).toBe(true);
  });

  it('the last mission is free play and never completes', () => {
    const s = newGame();
    s.mission = MISSIONS.length - 1;
    s.levels.station = 5;
    expect(advanceMission(s)).toBeNull();
  });
});
