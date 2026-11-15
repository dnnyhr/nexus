import { describe, expect, it } from 'vitest';
import { cleanName, NAME_MAX } from './profile';

describe('profile name', () => {
  it('trims and collapses spaces', () => {
    expect(cleanName('  Ana   María  ')).toBe('Ana María');
  });
  it('drops angle brackets and control characters', () => {
    expect(cleanName('<b>Leo</b>\n')).toBe('bLeo/b');
  });
  it('caps the length without a trailing space', () => {
    const n = cleanName('Comandante de la base lunar Nexus');
    expect(n.length).toBeLessThanOrEqual(NAME_MAX);
    expect(n).toBe(n.trim());
  });
  it('allows an empty name (the game uses the default)', () => {
    expect(cleanName('   ')).toBe('');
  });
});
