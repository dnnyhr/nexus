// The player's profile: for now, the astronaut's name. Commander Rivera and the lander's
// computer use it on the radio. It is kept apart from the game save, so starting a new
// game keeps the name.

export const NAME_MAX = 18;
const KEY = 'nexus.profile';

export interface Profile {
  name: string;
}

/** Trim, collapse spaces, drop control characters and angle brackets, cap the length. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

export function loadProfile(): Profile | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Profile> | null;
    if (p && typeof p.name === 'string') return { name: cleanName(p.name) };
  } catch {
    // Storage blocked or bad JSON: play without a saved profile.
  }
  return null;
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: cleanName(p.name) }));
  } catch {
    // Not saved, but the name still works for this session.
  }
}
