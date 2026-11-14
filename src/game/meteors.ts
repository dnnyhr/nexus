// Real meteor shower calendar. The Moon crosses the same meteoroid streams as Earth, so
// when a shower is active here, the Moon gets more micrometeoroid impacts too (NASA has
// filmed lunar impact flashes during showers such as the Geminids and the Leonids).
// There is no live sensor of individual lunar impacts, so the game uses the predicted
// calendar: dates and peak rates (ZHR) from the International Meteor Organization.

export interface Shower {
  id: string;
  name: { es: string; en: string };
  /** Active window and peak as [month, day] (month 1-12). */
  start: [number, number];
  peak: [number, number];
  end: [number, number];
  /** Zenithal hourly rate at the peak (meteors per hour seen from Earth). */
  zhr: number;
}

export const SHOWERS: Shower[] = [
  { id: 'QUA', name: { es: 'Cuadrántidas', en: 'Quadrantids' }, start: [12, 28], peak: [1, 3], end: [1, 12], zhr: 80 },
  { id: 'LYR', name: { es: 'Líridas', en: 'Lyrids' }, start: [4, 14], peak: [4, 22], end: [4, 30], zhr: 18 },
  { id: 'ETA', name: { es: 'Eta Acuáridas', en: 'Eta Aquariids' }, start: [4, 19], peak: [5, 6], end: [5, 28], zhr: 50 },
  { id: 'PER', name: { es: 'Perseidas', en: 'Perseids' }, start: [7, 17], peak: [8, 12], end: [8, 24], zhr: 100 },
  { id: 'ORI', name: { es: 'Oriónidas', en: 'Orionids' }, start: [10, 2], peak: [10, 21], end: [11, 7], zhr: 20 },
  { id: 'LEO', name: { es: 'Leónidas', en: 'Leonids' }, start: [11, 6], peak: [11, 17], end: [11, 30], zhr: 15 },
  { id: 'GEM', name: { es: 'Gemínidas', en: 'Geminids' }, start: [12, 4], peak: [12, 14], end: [12, 20], zhr: 150 },
];

/** Day of year (1-366) for a month/day, using a non-leap year (enough for a calendar). */
function doy(month: number, day: number): number {
  const before = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return before[month - 1] + day;
}

/** Days from a to b going forward around the year. */
function forward(a: number, b: number): number {
  return (b - a + 365) % 365;
}

/**
 * Shower active on a date, with its strength 0-1: 1 at the peak, falling linearly to the
 * edges of the window and scaled by its peak rate (relative to the strongest shower).
 */
export function activeShower(date: Date): { shower: Shower; strength: number } | null {
  const today = doy(date.getMonth() + 1, date.getDate());
  let best: { shower: Shower; strength: number } | null = null;
  for (const sh of SHOWERS) {
    const start = doy(...sh.start);
    const peak = doy(...sh.peak);
    const end = doy(...sh.end);
    const intoWindow = forward(start, today);
    if (intoWindow > forward(start, end)) continue;
    const toPeak = forward(start, peak);
    const shape = intoWindow <= toPeak
      ? intoWindow / Math.max(1, toPeak)
      : 1 - (intoWindow - toPeak) / Math.max(1, forward(peak, end));
    const strength = Math.max(0.15, shape) * Math.min(1, 0.35 + sh.zhr / 150);
    if (!best || strength > best.strength) best = { shower: sh, strength };
  }
  return best;
}
