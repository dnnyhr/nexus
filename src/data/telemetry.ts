// Telemetría espacial normalizada. Cada dato declara fuente, hora UTC, antigüedad,
// lugar, calidad, naturaleza y relación con la Luna. La procedencia se separa en
// LIVE (obtenido ahora de una API oficial), SNAPSHOT (copia fechada incluida con el
// juego) y UNAVAILABLE (no hay una medición verificada; nunca se rellena con un valor
// inventado). Las observaciones en órbita terrestre o en L1 son proxies: no son
// mediciones de la superficie lunar.

import snapshot from './snapshot.json';
import { activeShower } from '../game/meteors';
import { flareStrength, radiationBand, radiationScale, solarWindIndex } from './models';

export type DataStatus = 'LIVE' | 'SNAPSHOT' | 'UNAVAILABLE';
export type DataQuality = 'verified' | 'stale' | 'predicted' | 'unknown';
export type DataNature = 'observation' | 'prediction';
export type LunarRelevance =
  | 'direct-measurement'
  | 'upstream-proxy'
  | 'earth-orbit-proxy'
  | 'remote-observation'
  | 'prediction'
  | 'not-applicable';

export interface SourceRef {
  readonly name: string;
  readonly url: string;
  readonly api?: string;
}

export const DATA_SOURCES = {
  donki: {
    name: 'NASA DONKI',
    url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    api: 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR',
  },
  goes: {
    name: 'NOAA GOES (SWPC)',
    url: 'https://www.swpc.noaa.gov/products/goes-proton-flux',
    api: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json',
  },
  solarWind: {
    name: 'NOAA SWPC RTSW (L1)',
    url: 'https://www.swpc.noaa.gov/products/real-time-solar-wind',
    api: 'https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json',
  },
  solarWindRtsw: {
    name: 'NOAA SWPC RTSW (L1)',
    url: 'https://www.swpc.noaa.gov/products/real-time-solar-wind',
    api: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json',
  },
  imo: {
    name: 'IMO meteor shower calendar',
    url: 'https://www.imo.net/resources/calendar/',
  },
} as const;

export const DATA_LOCATIONS = {
  sun: 'Sol (observación remota desde órbita terrestre)',
  goes: 'Órbita geoestacionaria terrestre (GOES)',
  l1: 'Punto de Lagrange L1, a ~1,5 millones de km de la Tierra',
  imo: 'Corriente de meteoroides (predicción para Tierra y Luna)',
} as const;

export const FRESHNESS = {
  flaresSeconds: 24 * 3600,
  protonsSeconds: 30 * 60,
  solarWindSeconds: 30 * 60,
} as const;

export interface TelemetryDatum<T> {
  value: T | null;
  status: DataStatus;
  source: SourceRef;
  /** Hora UTC de la observación, del cierre de ventana o del inicio de validez. */
  utc: string | null;
  /** Segundos entre utc y la evaluación; null cuando no hay una hora verificable. */
  ageSeconds: number | null;
  location: string;
  quality: DataQuality;
  nature: DataNature;
  /** Cómo se relaciona con la superficie lunar. Nunca se asume medición directa. */
  lunarRelevance: LunarRelevance;
  note: string;
}

export interface Flare {
  id: string;
  peak: string;
  begin?: string;
  class: string;
  link: string;
  sourceLocation?: string;
  activeRegion?: number;
}

export interface FlareCounts {
  c: number;
  m: number;
  x: number;
}

export interface SolarActivity {
  flares: Flare[];
  counts: FlareCounts;
  last24h: { counts: FlareCounts; strongest: Flare | null };
  strongest: Flare | null;
  latest: Flare | null;
  window: { start: string; end: string; days: number };
}

export interface ProtonFlux {
  flux: number;
  energy: '>=10 MeV';
  scale: number;
  band: string;
  satellite: number | null;
}

export interface SolarWind {
  speedKmS: number;
  densityPerCm3: number | null;
  temperatureK: number | null;
  spacecraft: string | null;
  /** Índice didáctico 0-1; ver MODEL_SPECS['nexus.solar-wind-index.v1']. */
  index: number;
}

export interface MeteorActivity {
  active: boolean;
  shower: { id: string; name: { es: string; en: string }; zhr: number } | null;
  strength: number;
  utcDay: string;
}

export interface SpaceTelemetry {
  fetchedAt: string;
  status: DataStatus;
  solarActivity: TelemetryDatum<SolarActivity>;
  protons: TelemetryDatum<ProtonFlux>;
  solarWind: TelemetryDatum<SolarWind>;
  meteors: TelemetryDatum<MeteorActivity>;
}

export interface DatumInit<T> {
  value: T | null;
  status: DataStatus;
  source: SourceRef;
  utc: unknown;
  location: string;
  quality: DataQuality;
  nature: DataNature;
  lunarRelevance: LunarRelevance;
  note: string;
  now: Date;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function parseUtcMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(`${text}T00:00:00Z`);
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

export function toUtcIso(value: unknown): string | null {
  const ms = parseUtcMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

function ageSince(utc: string | null, now: Date): number | null {
  const ms = parseUtcMs(utc);
  if (ms === null) return null;
  return Math.max(0, Math.round((now.getTime() - ms) / 1000));
}

function qualitySince(utc: string | null, now: Date, maxAgeSeconds: number): DataQuality {
  const age = ageSince(utc, now);
  if (age === null) return 'unknown';
  return age <= maxAgeSeconds ? 'verified' : 'stale';
}

export function makeDatum<T>(init: DatumInit<T>): TelemetryDatum<T> {
  const utc = toUtcIso(init.utc);
  return {
    value: init.value,
    status: init.status,
    source: init.source,
    utc,
    ageSeconds: ageSince(utc, init.now),
    location: init.location,
    quality: init.quality,
    nature: init.nature,
    lunarRelevance: init.lunarRelevance,
    note: init.note,
  };
}

function unavailable<T>(
  source: SourceRef,
  location: string,
  note: string,
  now: Date,
  lunarRelevance: LunarRelevance,
  nature: DataNature = 'observation',
): TelemetryDatum<T> {
  return makeDatum<T>({
    value: null,
    status: 'UNAVAILABLE',
    source,
    utc: null,
    location,
    quality: 'unknown',
    nature,
    lunarRelevance,
    note,
    now,
  });
}

export function flareLetter(cls: string): 'A' | 'B' | 'C' | 'M' | 'X' | null {
  const letter = String(cls ?? '').trim().charAt(0).toUpperCase();
  return letter === 'A' || letter === 'B' || letter === 'C' || letter === 'M' || letter === 'X' ? letter : null;
}

function emptyCounts(): FlareCounts {
  return { c: 0, m: 0, x: 0 };
}

export function countFlares(flares: Flare[]): FlareCounts {
  const counts = emptyCounts();
  for (const flare of flares) {
    const letter = flareLetter(flare.class);
    if (letter === 'C') counts.c++;
    if (letter === 'M') counts.m++;
    if (letter === 'X') counts.x++;
  }
  return counts;
}

export function strongestFlare(flares: Flare[]): Flare | null {
  let best: Flare | null = null;
  for (const flare of flares) {
    if (!best) {
      best = flare;
      continue;
    }
    const delta = flareStrength(flare.class) - flareStrength(best.class);
    if (delta > 0 || (delta === 0 && flare.peak > best.peak)) best = flare;
  }
  return best;
}

export function parseDonkiFlares(raw: unknown): Flare[] {
  if (!Array.isArray(raw)) return [];
  const flares: Flare[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof (row.flrID ?? row.id) === 'string' ? String(row.flrID ?? row.id).trim() : '';
    const cls = typeof (row.classType ?? row.class) === 'string' ? String(row.classType ?? row.class).trim() : '';
    const peak = toUtcIso(row.peakTime ?? row.peak ?? row.beginTime ?? row.begin);
    if (!id || !flareLetter(cls) || !peak) continue;
    const begin = toUtcIso(row.beginTime ?? row.begin);
    const link = typeof row.link === 'string' && row.link.trim() ? row.link.trim() : DATA_SOURCES.donki.url;
    const sourceLocation = typeof row.sourceLocation === 'string' ? row.sourceLocation : undefined;
    const activeRegion = finiteNumber(row.activeRegionNum);
    flares.push({
      id,
      peak,
      ...(begin ? { begin } : {}),
      class: cls,
      link,
      ...(sourceLocation ? { sourceLocation } : {}),
      ...(activeRegion !== null ? { activeRegion } : {}),
    });
  }
  flares.sort((a, b) => (parseUtcMs(a.peak) ?? 0) - (parseUtcMs(b.peak) ?? 0));
  return flares;
}

export function summarizeActivity(
  flares: Flare[],
  windowStart: unknown,
  windowEnd: unknown,
  feedUtc: string,
): SolarActivity {
  const start = toUtcIso(windowStart) ?? feedUtc;
  const end = toUtcIso(windowEnd) ?? feedUtc;
  const endMs = parseUtcMs(end) ?? 0;
  const startMs = parseUtcMs(start) ?? endMs;
  const last24h = flares.filter((flare) => {
    const ms = parseUtcMs(flare.peak);
    return ms !== null && ms >= endMs - 24 * 3600_000 && ms <= endMs;
  });
  const days = Math.max(1, Math.round((endMs - startMs) / 86400_000));
  return {
    flares,
    counts: countFlares(flares),
    last24h: { counts: countFlares(last24h), strongest: strongestFlare(last24h) },
    strongest: strongestFlare(flares),
    latest: flares.length ? flares[flares.length - 1] : null,
    window: { start, end, days },
  };
}

export interface ProtonReading {
  proton: ProtonFlux;
  utc: string;
}

export function parseGoesProtons(raw: unknown): ProtonReading | null {
  if (!Array.isArray(raw)) return null;
  let best: { utc: string; ms: number; flux: number; satellite: number | null } | null = null;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (row.energy !== '>=10 MeV') continue;
    const flux = finiteNumber(row.flux);
    const utc = toUtcIso(row.time_tag);
    const ms = parseUtcMs(utc);
    if (flux === null || flux < 0 || !utc || ms === null) continue;
    if (!best || ms >= best.ms) {
      best = { utc, ms, flux, satellite: finiteNumber(row.satellite) };
    }
  }
  if (!best) return null;
  const scale = radiationScale(best.flux);
  return {
    proton: {
      flux: best.flux,
      energy: '>=10 MeV',
      scale,
      band: radiationBand(scale).code,
      satellite: best.satellite,
    },
    utc: best.utc,
  };
}

export interface SolarWindReading {
  speedKmS: number;
  densityPerCm3: number | null;
  temperatureK: number | null;
  spacecraft: string | null;
  utc: string;
}

export function parseSolarWindSpeed(raw: unknown): SolarWindReading | null {
  if (!Array.isArray(raw)) return null;
  let best: { reading: SolarWindReading; ms: number } | null = null;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const speed = finiteNumber(row.proton_speed);
    const utc = toUtcIso(row.time_tag);
    const ms = parseUtcMs(utc);
    if (speed === null || speed <= 0 || !utc || ms === null) continue;
    const reading: SolarWindReading = {
      speedKmS: speed,
      densityPerCm3: finiteNumber(row.proton_density),
      temperatureK: finiteNumber(row.proton_temperature),
      spacecraft: typeof row.source === 'string' ? row.source : null,
      utc,
    };
    if (!best || ms >= best.ms) best = { reading, ms };
  }
  return best?.reading ?? null;
}

function parseRtswRow(item: unknown): (SolarWindReading & { active: boolean; ms: number }) | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const speed = finiteNumber(row.proton_speed);
  const density = finiteNumber(row.proton_density);
  const temperature = finiteNumber(row.proton_temperature);
  const utc = toUtcIso(row.time_tag);
  const ms = parseUtcMs(utc);
  if (speed === null || speed <= 0 || !utc || ms === null) return null;
  return {
    speedKmS: speed,
    densityPerCm3: density !== null && density >= 0 ? density : null,
    temperatureK: temperature,
    spacecraft: typeof row.source === 'string' ? row.source : null,
    utc,
    active: row.active === true,
    ms,
  };
}

/**
 * El feed RTSW completo pesa varios MB. Se solicita un rango final y se extraen los
 * objetos completos; si el servidor devuelve el array entero, también se acepta.
 */
export function parseRtswTail(text: string): SolarWindReading | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  let rows: unknown[] | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    rows = null;
  }
  if (!rows) {
    rows = [];
    const objects = text.match(/\{\s*"time_tag"\s*:\s*"[^"]+"[^{}]*\}/g) ?? [];
    for (const object of objects) {
      try {
        rows.push(JSON.parse(object));
      } catch {
        // Fragmento incompleto al inicio del rango: se ignora.
      }
    }
  }
  const valid = rows.map(parseRtswRow).filter((row): row is NonNullable<typeof row> => row !== null);
  if (!valid.length) return null;
  const active = valid.filter((row) => row.active);
  const pool = active.length ? active : valid;
  const latest = pool.reduce((best, row) => (row.ms >= best.ms ? row : best));
  return {
    speedKmS: latest.speedKmS,
    densityPerCm3: latest.densityPerCm3,
    temperatureK: latest.temperatureK,
    spacecraft: latest.spacecraft,
    utc: latest.utc,
  };
}

function meteorDatum(now: Date): TelemetryDatum<MeteorActivity> {
  const utcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const localNoon = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0);
  const current = activeShower(localNoon);
  const value: MeteorActivity = {
    active: current !== null,
    shower: current
      ? { id: current.shower.id, name: { ...current.shower.name }, zhr: current.shower.zhr }
      : null,
    strength: current ? clamp01(current.strength) : 0,
    utcDay,
  };
  return makeDatum({
    value,
    status: 'SNAPSHOT',
    source: DATA_SOURCES.imo,
    utc: utcDay,
    location: DATA_LOCATIONS.imo,
    quality: 'predicted',
    nature: 'prediction',
    lunarRelevance: 'prediction',
    note:
      'Calendario IMO incluido con el juego: predicción de actividad, no medición de impactos lunares. ' +
      'La Luna cruza las mismas corrientes que la Tierra.',
    now,
  });
}

function overallStatus(datums: { status: DataStatus }[]): DataStatus {
  if (datums.some((datum) => datum.status === 'LIVE')) return 'LIVE';
  if (datums.some((datum) => datum.status === 'SNAPSHOT')) return 'SNAPSHOT';
  return 'UNAVAILABLE';
}

export function snapshotTelemetry(now = new Date()): SpaceTelemetry {
  const fetchedAt = toUtcIso(snapshot.fetchedAt) ?? new Date(0).toISOString();
  const flares = parseDonkiFlares(snapshot.flares);
  const windowStart = toUtcIso(snapshot.window[0]) ?? fetchedAt;
  const windowEnd = toUtcIso(snapshot.window[1]) ?? fetchedAt;
  const activity = summarizeActivity(flares, windowStart, windowEnd, fetchedAt);

  const solarActivity = makeDatum<SolarActivity>({
    value: activity,
    status: 'SNAPSHOT',
    source: DATA_SOURCES.donki,
    utc: fetchedAt,
    location: DATA_LOCATIONS.sun,
    quality: qualitySince(fetchedAt, now, FRESHNESS.flaresSeconds),
    nature: 'observation',
    lunarRelevance: 'remote-observation',
    note:
      `Snapshot local de NASA DONKI fechado ${fetchedAt}. Ventana ${windowStart.slice(0, 10)} a ` +
      `${windowEnd.slice(0, 10)}. No es una observación lunar directa.`,
    now,
  });

  const protonScale = radiationScale(snapshot.protons.flux);
  const protons = makeDatum<ProtonFlux>({
    value: {
      flux: snapshot.protons.flux,
      energy: '>=10 MeV',
      scale: protonScale,
      band: radiationBand(protonScale).code,
      satellite: snapshot.protons.satellite ?? null,
    },
    status: 'SNAPSHOT',
    source: DATA_SOURCES.goes,
    utc: snapshot.protons.time,
    location: `Órbita geoestacionaria terrestre (GOES-${snapshot.protons.satellite ?? '?'})`,
    quality: qualitySince(snapshot.protons.time, now, FRESHNESS.protonsSeconds),
    nature: 'observation',
    lunarRelevance: 'earth-orbit-proxy',
    note:
      `Snapshot local de NOAA GOES fechado ${toUtcIso(snapshot.protons.time) ?? 'sin hora'}. ` +
      'Es una medición en órbita terrestre, no en la superficie lunar.',
    now,
  });

  const solarWind = unavailable<SolarWind>(
    DATA_SOURCES.solarWind,
    DATA_LOCATIONS.l1,
    'El snapshot no contiene viento solar. No se inventa una medición ni se usa otro dato como sustituto.',
    now,
    'upstream-proxy',
  );

  const meteors = meteorDatum(now);

  return {
    fetchedAt,
    status: overallStatus([solarActivity, protons, solarWind, meteors]),
    solarActivity,
    protons,
    solarWind,
    meteors,
  };
}

export interface LiveRaw {
  flares?: unknown;
  protons?: unknown;
  solarWindSpeed?: unknown;
  solarWindTail?: string;
}

function goesLocation(satellite: number | null): string {
  return satellite === null
    ? DATA_LOCATIONS.goes
    : `Órbita geoestacionaria terrestre (GOES-${satellite})`;
}

function newerWind(a: SolarWindReading | null, b: SolarWindReading | null): SolarWindReading | null {
  if (!a) return b;
  if (!b) return a;
  return (parseUtcMs(a.utc) ?? 0) >= (parseUtcMs(b.utc) ?? 0) ? a : b;
}

function liveSolarWindDatum(
  speedReading: SolarWindReading | null,
  tailReading: SolarWindReading | null,
  now: Date,
): TelemetryDatum<SolarWind> {
  const freshest = newerWind(speedReading, tailReading);
  if (!freshest) {
    return unavailable<SolarWind>(
      DATA_SOURCES.solarWind,
      DATA_LOCATIONS.l1,
      'Sin medición verificada de viento solar en esta actualización. No se inventa velocidad ni densidad.',
      now,
      'upstream-proxy',
    );
  }
  const tailAge = tailReading ? ageSince(tailReading.utc, now) : null;
  const tailFresh = tailReading !== null && tailAge !== null && tailAge <= FRESHNESS.solarWindSeconds;
  const density = tailFresh ? tailReading.densityPerCm3 : null;
  const temperature = tailFresh ? tailReading.temperatureK : null;
  const spacecraft = tailFresh ? (tailReading.spacecraft ?? freshest.spacecraft) : freshest.spacecraft;
  const index = solarWindIndex(freshest.speedKmS, density);
  return makeDatum<SolarWind>({
    value: {
      speedKmS: freshest.speedKmS,
      densityPerCm3: density,
      temperatureK: temperature,
      spacecraft,
      index,
    },
    status: 'LIVE',
    source: DATA_SOURCES.solarWind,
    utc: freshest.utc,
    location: spacecraft ? `Punto de Lagrange L1 (NOAA SWPC RTSW, ${spacecraft})` : DATA_LOCATIONS.l1,
    quality: qualitySince(freshest.utc, now, FRESHNESS.solarWindSeconds),
    nature: 'observation',
    lunarRelevance: 'upstream-proxy',
    note: density === null
      ? 'Velocidad verificada en L1; densidad no disponible en esta actualización. No se inventa la densidad. Medición aguas arriba, no en la superficie lunar.'
      : 'Velocidad y densidad verificadas en L1, aguas arriba de la Tierra. No son mediciones de la superficie lunar.',
    now,
  });
}

export function telemetryFromLive(raw: LiveRaw, now = new Date(), windowDays = 30): SpaceTelemetry {
  const base = snapshotTelemetry(now);

  const solarActivity = Array.isArray(raw.flares)
    ? (() => {
        const flares = parseDonkiFlares(raw.flares);
        const start = new Date(now.getTime() - windowDays * 86400_000).toISOString();
        const end = now.toISOString();
        const activity = summarizeActivity(flares, start, end, end);
        return makeDatum<SolarActivity>({
          value: activity,
          status: 'LIVE',
          source: DATA_SOURCES.donki,
          utc: end,
          location: DATA_LOCATIONS.sun,
          quality: 'verified',
          nature: 'observation',
          lunarRelevance: 'remote-observation',
          note: `Datos en vivo de NASA DONKI, ventana de ${windowDays} días. La clase es una observación solar remota, no una medición lunar.`,
          now,
        });
      })()
    : base.solarActivity;

  const protonReading = parseGoesProtons(raw.protons);
  const protons = protonReading
    ? makeDatum<ProtonFlux>({
        value: protonReading.proton,
        status: 'LIVE',
        source: DATA_SOURCES.goes,
        utc: protonReading.utc,
        location: goesLocation(protonReading.proton.satellite),
        quality: qualitySince(protonReading.utc, now, FRESHNESS.protonsSeconds),
        nature: 'observation',
        lunarRelevance: 'earth-orbit-proxy',
        note:
          'Flujo de protones >=10 MeV medido por NOAA GOES en órbita geoestacionaria. ' +
          'Es una observación cercana a la Tierra, no una medición de la superficie lunar.',
        now,
      })
    : base.protons;

  const speedReading = parseSolarWindSpeed(raw.solarWindSpeed);
  const tailReading = typeof raw.solarWindTail === 'string' ? parseRtswTail(raw.solarWindTail) : null;
  const solarWind = liveSolarWindDatum(speedReading, tailReading, now);
  const meteors = base.meteors;

  return {
    fetchedAt: now.toISOString(),
    status: overallStatus([solarActivity, protons, solarWind, meteors]),
    solarActivity,
    protons,
    solarWind,
    meteors,
  };
}

export interface TelemetryFetcher {
  json(url: string, init?: RequestInit): Promise<unknown>;
  text(url: string, init?: RequestInit): Promise<string>;
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) throw new Error(String(response.status));
  return response.text();
}

export const defaultTelemetryFetcher: TelemetryFetcher = { json: fetchJson, text: fetchText };

function donkiUrl(now: Date, windowDays: number): string {
  const start = new Date(now.getTime() - windowDays * 86400_000).toISOString().slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  return `${DATA_SOURCES.donki.api}?startDate=${start}&endDate=${end}`;
}

/** Nunca lanza: cada fuente cae a snapshot o a UNAVAILABLE por separado. */
export async function loadTelemetry(
  now = new Date(),
  fetcher: TelemetryFetcher = defaultTelemetryFetcher,
  windowDays = 30,
): Promise<SpaceTelemetry> {
  const [flares, protons, speed, tail] = await Promise.allSettled([
    fetcher.json(donkiUrl(now, windowDays)),
    fetcher.json(DATA_SOURCES.goes.api),
    fetcher.json(DATA_SOURCES.solarWind.api),
    // NOAA does not allow the Range header cross-origin and the full RTSW file is ~3 MB: in a
    // browser the 1-minute summary above is the solar-wind source.
    fetcher === defaultTelemetryFetcher && typeof window !== 'undefined'
      ? Promise.reject(new Error('RTSW tail not available cross-origin'))
      : fetcher.text(DATA_SOURCES.solarWindRtsw.api, { headers: { Range: 'bytes=-16384' } }),
  ]);
  return telemetryFromLive(
    {
      flares: flares.status === 'fulfilled' ? flares.value : undefined,
      protons: protons.status === 'fulfilled' ? protons.value : undefined,
      solarWindSpeed: speed.status === 'fulfilled' ? speed.value : undefined,
      solarWindTail: tail.status === 'fulfilled' ? tail.value : undefined,
    },
    now,
    windowDays,
  );
}
