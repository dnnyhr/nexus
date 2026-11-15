// Compatibilidad con la API de clima espacial existente (Modo libre) y punto único
// de entrada a la telemetría normalizada. Las mediciones reales vienen de NASA DONKI
// y NOAA SWPC; sin conexión se usan snapshots locales fechados y se señala el estado.
// Nunca se inventan mediciones ni se presentan observaciones cercanas a la Tierra
// como mediciones de la superficie lunar.

import {
  DATA_SOURCES,
  countFlares,
  loadTelemetry,
  parseDonkiFlares,
  parseGoesProtons,
  parseRtswTail,
  parseSolarWindSpeed,
  snapshotTelemetry,
  strongestFlare,
  telemetryFromLive,
  type DataNature,
  type DataQuality,
  type DataStatus,
  type Flare,
  type LunarRelevance,
  type ProtonReading,
  type SpaceTelemetry,
  type TelemetryDatum,
  type SolarWindReading,
  type TelemetryFetcher,
} from './telemetry';
import { flareStrength, radiationBand, radiationScale, solarWindIndex } from './models';

export interface SpaceWeather {
  live: boolean;
  /** When the data was fetched (ISO). */
  fetchedAt: string;
  flares: Flare[];
  protons: { time: string; flux: number };
}

export const SOURCES = {
  donki: DATA_SOURCES.donki.url,
  donkiApi: DATA_SOURCES.donki.api,
  goes: DATA_SOURCES.goes.url,
  goesApi: DATA_SOURCES.goes.api,
  solarWind: DATA_SOURCES.solarWind.url,
  solarWindSpeedApi: DATA_SOURCES.solarWind.api,
  solarWindRtswApi: DATA_SOURCES.solarWindRtsw.api,
  imo: DATA_SOURCES.imo.url,
};

export function toSpaceWeather(telemetry: SpaceTelemetry): SpaceWeather {
  const activity = telemetry.solarActivity.value;
  const protons = telemetry.protons.value;
  return {
    live: telemetry.solarActivity.status === 'LIVE' && telemetry.protons.status === 'LIVE',
    fetchedAt: telemetry.fetchedAt,
    flares: activity?.flares ?? [],
    protons: protons ? { time: telemetry.protons.utc ?? telemetry.fetchedAt, flux: protons.flux } : { time: telemetry.fetchedAt, flux: 0 },
  };
}

export function snapshotWeather(now = new Date()): SpaceWeather {
  return toSpaceWeather(snapshotTelemetry(now));
}

/** Live data when reachable; otherwise the saved snapshot. Never throws. */
export async function loadSpaceWeather(now = new Date()): Promise<SpaceWeather> {
  return toSpaceWeather(await loadTelemetry(now));
}

export interface MissionTelemetrySignal {
  model: 'nexus.historical-flare.v1';
  kind: 'observation' | 'estimation' | 'prediction' | 'simulation';
  source: string;
  sourceUrl: string;
  observationUtc: string | null;
  observedAtLocation: string;
  lunarRelation: string;
  quality: 'verified' | 'stale' | 'predicted' | 'unknown';
  note: string;
}

export interface HistoricalMissionScenario {
  id: string;
  title: string;
  description: string;
  flare: Flare;
  counts: { c: number; m: number; x: number };
  totalFlares: number;
  /** Intensidad didáctica derivada de la clase observada: ver nexus.flare-class.v1. */
  strength: number;
  /** Nivel NOAA S0-S5 según el contexto del snapshot, no según la superficie lunar. */
  radiationScale: number;
  snapshot: {
    fetchedAt: string;
    window: [string, string];
    status: DataStatus;
    note: string;
  };
  signal: MissionTelemetrySignal;
}

export function historicalMissionScenario(now = new Date()): HistoricalMissionScenario {
  const telemetry = snapshotTelemetry(now);
  const activity = telemetry.solarActivity.value;
  const flares = activity?.flares ?? [];
  const chosen = activity?.strongest ?? strongestFlare(flares) ?? flares[flares.length - 1] ?? null;
  if (!chosen || !activity) {
    return {
      id: 'mision-1-historical-unavailable',
      title: 'Crisis histórica no disponible',
      description: 'No hay un snapshot verificado de fulguraciones para reproducir una crisis histórica.',
      flare: { id: 'unavailable', peak: telemetry.fetchedAt, class: 'C1.0', link: DATA_SOURCES.donki.url },
      counts: { c: 0, m: 0, x: 0 },
      totalFlares: 0,
      strength: 0,
      radiationScale: telemetry.protons.value?.scale ?? 0,
      snapshot: {
        fetchedAt: telemetry.fetchedAt,
        window: [telemetry.fetchedAt.slice(0, 10), telemetry.fetchedAt.slice(0, 10)],
        status: 'UNAVAILABLE',
        note: telemetry.solarActivity.note,
      },
      signal: {
        model: 'nexus.historical-flare.v1',
        kind: 'simulation',
        source: DATA_SOURCES.donki.name,
        sourceUrl: DATA_SOURCES.donki.url,
        observationUtc: null,
        observedAtLocation: DATA_SOURCES.donki.name,
        lunarRelation: 'not-applicable',
        quality: 'unknown',
        note: 'Sin observaciones verificadas para reproducir una crisis histórica.',
      },
    };
  }
  const counts = countFlares(flares);
  return {
    id: `mision-1-historical-${chosen.id}`,
    title: `Crisis histórica ${chosen.class}`,
    description:
      `Reproduce la fulguración ${chosen.class} observada por NASA DONKI el ${chosen.peak}. ` +
      'La observación es real y fechada; su efecto en misión es una estimación didáctica explícita.',
    flare: chosen,
    counts,
    totalFlares: flares.length,
    strength: flareStrength(chosen.class),
    radiationScale: telemetry.protons.value?.scale ?? 0,
    snapshot: {
      fetchedAt: telemetry.fetchedAt,
      window: [activity.window.start.slice(0, 10), activity.window.end.slice(0, 10)],
      status: telemetry.solarActivity.status,
      note: telemetry.solarActivity.note,
    },
    signal: {
      model: 'nexus.historical-flare.v1',
      kind: 'estimation',
      source: DATA_SOURCES.donki.name,
      sourceUrl: chosen.link || DATA_SOURCES.donki.url,
      observationUtc: chosen.peak,
      observedAtLocation: telemetry.solarActivity.location,
      lunarRelation: 'remote-observation',
      quality: telemetry.solarActivity.quality === 'verified' ? 'verified' : 'stale',
      note:
        'Observación solar real usada como inspiración fechada. ' +
        'La intensidad aplicada en misión es una derivación didáctica, no una medición lunar directa.',
    },
  };
}

export { flareStrength, radiationBand, radiationScale, solarWindIndex };
export { DATA_SOURCES, countFlares, loadTelemetry, parseDonkiFlares, parseGoesProtons, parseRtswTail, parseSolarWindSpeed, snapshotTelemetry, strongestFlare, telemetryFromLive };
export type { DataNature, DataQuality, DataStatus, Flare, LunarRelevance, ProtonReading, SpaceTelemetry, TelemetryDatum, TelemetryFetcher, SolarWindReading };
