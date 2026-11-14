import snapshot from './snapshot.json';

// Real space weather. Solar flares come from NASA DONKI (the Space Weather Database of
// Notifications, Knowledge, Information); the current proton flux comes from the GOES
// satellites (NOAA SWPC). The game tries the live data first; without internet it uses a
// snapshot saved with the game and says so, so static data is never shown as live.

export interface Flare {
  id: string;
  /** ISO time of the flare peak. */
  peak: string;
  /** X-ray class, e.g. "M6.7". */
  class: string;
  link: string;
}

export interface SpaceWeather {
  live: boolean;
  /** When the data was fetched (ISO). */
  fetchedAt: string;
  flares: Flare[];
  protons: { time: string; flux: number };
}

export const SOURCES = {
  donki: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
  donkiApi: 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR',
  goes: 'https://www.swpc.noaa.gov/products/goes-proton-flux',
  goesApi: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json',
};

export function snapshotWeather(): SpaceWeather {
  return { live: false, fetchedAt: snapshot.fetchedAt, flares: snapshot.flares, protons: snapshot.protons };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

async function getJson(url: string, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Live data when reachable; otherwise the saved snapshot. Never throws. */
export async function loadSpaceWeather(now = new Date()): Promise<SpaceWeather> {
  try {
    const start = new Date(now.getTime() - 59 * 86400_000);
    const [flr, goes] = await Promise.all([
      getJson(`${SOURCES.donkiApi}?startDate=${day(start)}&endDate=${day(now)}`) as Promise<{ flrID: string; peakTime?: string; beginTime: string; classType?: string; link?: string }[]>,
      getJson(SOURCES.goesApi) as Promise<{ time_tag: string; flux: number; energy: string }[]>,
    ]);
    const flares = flr.filter((f) => f.classType).map((f) => ({ id: f.flrID, peak: f.peakTime ?? f.beginTime, class: f.classType!, link: f.link ?? '' }));
    const p10 = goes.filter((g) => g.energy === '>=10 MeV');
    const last = p10[p10.length - 1];
    if (!flares.length || !last) throw new Error('empty');
    return { live: true, fetchedAt: now.toISOString(), flares, protons: { time: last.time_tag, flux: last.flux } };
  } catch {
    return snapshotWeather();
  }
}

/** Flare strength 0-1 from its X-ray class (C1 ≈ 0.1 … X1 ≈ 0.75 … X5+ = 1). */
export function flareStrength(cls: string): number {
  const letter = cls[0];
  const n = parseFloat(cls.slice(1)) || 1;
  const base = { A: 0, B: 0.02, C: 0.1, M: 0.4, X: 0.75 }[letter as 'A'] ?? 0.1;
  const span = { A: 0.02, B: 0.08, C: 0.3, M: 0.35, X: 0.25 }[letter as 'A'] ?? 0.1;
  return Math.min(1, base + span * Math.min(1, Math.log10(n) / Math.log10(9.9) + 0.1));
}

/** NOAA solar radiation storm level from the ≥10 MeV proton flux (S1 starts at 10 pfu). */
export function radiationScale(flux: number): number {
  if (flux >= 1e5) return 5;
  if (flux >= 1e4) return 4;
  if (flux >= 1e3) return 3;
  if (flux >= 100) return 2;
  if (flux >= 10) return 1;
  return 0;
}
