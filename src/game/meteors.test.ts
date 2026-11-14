import { describe, expect, it } from 'vitest';
import { activeShower } from './meteors';

describe('meteor shower calendar', () => {
  it('the Leonids are active in mid November, strongest at the peak', () => {
    const before = activeShower(new Date(2026, 10, 10));
    const peak = activeShower(new Date(2026, 10, 17));
    expect(before?.shower.id).toBe('LEO');
    expect(peak?.shower.id).toBe('LEO');
    expect(peak!.strength).toBeGreaterThan(before!.strength);
  });

  it('handles showers that cross the new year (Quadrantids)', () => {
    expect(activeShower(new Date(2027, 0, 3))?.shower.id).toBe('QUA');
    expect(activeShower(new Date(2026, 11, 30))?.shower.id).toBe('QUA');
  });

  it('quiet days have no shower', () => {
    expect(activeShower(new Date(2026, 2, 10))).toBeNull();
  });
});
