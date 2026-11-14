import { describe, expect, it } from 'vitest';
import { STORM } from './config';
import { doseRate, pickFlare, protection, startStorm, stepStorm } from './storm';
import { developedGame } from './testing';

const flares = [
  { id: 'a', peak: '2026-10-01T00:00Z', class: 'C2.0', link: '' },
  { id: 'b', peak: '2026-10-02T00:00Z', class: 'M6.7', link: '' },
  { id: 'c', peak: '2026-10-03T00:00Z', class: 'M1.2', link: '' },
];

describe('solar storms', () => {
  it('recreate the strongest real flares first', () => {
    expect(pickFlare(flares, 0)?.class).toBe('M6.7');
    expect(pickFlare(flares, 1)?.class).toBe('M1.2');
  });

  it('go from warning to active to end', () => {
    const s = developedGame();
    startStorm(s, flares[1]);
    expect(s.storm.phase).toBe('warning');
    let events: string[] = [];
    for (let i = 0; i < 200; i++) {
      const e = stepStorm(s, 1, true, flares);
      if (e) events.push(e);
      if (e === 'end') break;
    }
    expect(events).toEqual(['active', 'end']);
  });

  it('the shelter cuts the dose; the habitat protects more than the lander', () => {
    const s = developedGame();
    startStorm(s, flares[1]);
    s.storm.phase = 'active';
    const outside = doseRate(s);
    s.sheltered = true;
    const habitat = doseRate(s);
    s.levels.station = 0;
    const lander = doseRate(s);
    expect(habitat).toBeLessThan(lander);
    expect(lander).toBeLessThan(outside);
  });

  it('staying outside during a storm hurts the crew', () => {
    const s = developedGame();
    startStorm(s, flares[1]);
    s.storm.phase = 'active';
    s.storm.timeLeft = 30;
    for (let i = 0; i < 20; i++) stepStorm(s, 1, true, flares);
    expect(s.dose).toBeGreaterThan(0);
    expect(s.crewHealth).toBeLessThan(100);
  });

  it('a live GOES reading at storm level (S1, 10 pfu) triggers a real storm', () => {
    const s = developedGame();
    expect(stepStorm(s, 1, true, flares, 12)).toBe('warning');
    expect(s.storm.live).toBe(true);
  });

  it('no storms before they are enabled', () => {
    const s = developedGame();
    for (let i = 0; i < STORM.firstDelay + 10; i++) expect(stepStorm(s, 1, false, flares)).toBeNull();
  });

  it('protection grows with the berm', () => {
    const s = developedGame();
    s.sheltered = true;
    const low = protection(s);
    s.levels.shield = 3;
    expect(protection(s)).toBeGreaterThan(low);
  });
});
