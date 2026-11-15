import { describe, expect, it } from 'vitest';
import { applyCommand, CADET_DESIGN, checkDesign, startMission, summarize, worldStep, type Command, type Design } from './index';

function fly(design: Design, shelter: boolean) {
  const ms = startMission(design);
  const send = (c: Command) => applyCommand(ms, c);
  while (ms.phase === 'running') {
    if (shelter && ms.t === 485) send({ type: 'enterShelter' });
    if (shelter && ms.t === 540) send({ type: 'leaveShelter' });
    worldStep(ms);
  }
  return summarize(ms);
}

describe('cadet training base', () => {
  it('is a valid design that leaves budget for a redesign', () => {
    const check = checkDesign(CADET_DESIGN);
    expect(check.ok).toBe(true);
    expect(check.spent).toBe(70);
  });

  it('the darkness is a measurable power crisis, and sheltering from the storm wins', () => {
    const s = fly(CADET_DESIGN, true);
    expect(s.phase).toBe('victory');
    expect(s.secondsLightsShed).toBeGreaterThan(0);
    expect(s.secondsLifeSupportUnpowered).toBeGreaterThan(0);
    expect(s.minCrewHealth).toBeLessThan(100);
    expect(s.exposure).toBeLessThan(10);
  });

  it('staying outside during the storm fails by exposure', () => {
    const s = fly(CADET_DESIGN, false);
    expect(s.phase).toBe('failed');
    expect(s.failure?.code).toBe('exposure_exceeded');
  });

  it('redesigning with one battery removes the power cuts', () => {
    const s = fly({ ...CADET_DESIGN, batteries: 1 }, true);
    expect(s.phase).toBe('victory');
    expect(s.secondsShortage).toBe(0);
    expect(s.minCrewHealth).toBe(100);
  });
});
