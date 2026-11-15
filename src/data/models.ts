// Modelos explícitos de telemetría. Separan observaciones de estimaciones y de
// predicciones. Ninguno de estos modelos es una dosis médica ni una predicción oficial:
// cada uno declara su procedencia y sus límites en MODEL_SPECS.

export const MODEL_SPECS = {
  'nexus.flare-class.v1': {
    title: 'Severidad relativa por clase de fulguración GOES',
    kind: 'didactic',
    description:
      'Convierte la clase de rayos X C/M/X en un valor 0-1 con base y amplitud explícitas. Sirve para ordenar fulguraciones dentro del juego.',
    limitations: [
      'No es una dosis, una tasa de partículas ni una predicción de tormenta.',
      'La clase GOES describe el pico de rayos X, no la energía de las partículas que llegan a la Luna.',
      'Dos fulguraciones de la misma clase pueden producir efectos distintos.',
    ],
  },
  'nexus.noaa-s-scale.v1': {
    title: 'Escala NOAA de tormenta de radiación solar (S1-S5)',
    kind: 'official',
    description:
      'Aplica los umbrales NOAA de flujo de protones >=10 MeV: S1 desde 10 pfu, S2 desde 100, S3 desde 1 000, S4 desde 10 000 y S5 desde 100 000 pfu.',
    limitations: [
      'La medición de GOES es en órbita geoestacionaria terrestre, no en la superficie lunar.',
      'S0 significa que no se alcanza el umbral S1, no que la radiación sea cero.',
    ],
  },
  'nexus.solar-wind-index.v1': {
    title: 'Índice didáctico de viento solar',
    kind: 'didactic',
    description:
      'Combina velocidad y densidad del viento solar con puntos de corte explícitos: 0,75 por velocidad y 0,25 por densidad. La densidad solo se usa si existe una medición verificada.',
    limitations: [
      'No existe una escala NOAA oficial de severidad basada solo en velocidad y densidad.',
      'No predice clima espacial ni radiación en la Luna.',
      'Los puntos de corte son una convención del juego, no umbrales físicos universales.',
    ],
  },
  'nexus.imo-meteor-calendar.v1': {
    title: 'Calendario IMO de lluvias de meteoros',
    kind: 'prediction',
    description:
      'Estima la actividad de meteoros para el día UTC a partir de las ventanas y tasas cenitales del calendario de la International Meteor Organization.',
    limitations: [
      'Es una predicción de calendario, no una medición de impactos lunares.',
      'La Luna cruza las mismas corrientes que la Tierra, pero no hay un sensor de impactos individuales.',
      'La tasa cenital horaria (ZHR) se mide desde la Tierra y no equivale a impactos por hora en la base.',
    ],
  },
  'nexus.historical-flare.v1': {
    title: 'Reproducción de una fulguración histórica real',
    kind: 'didactic',
    description:
      'Selecciona una fulguración observada por NASA DONKI y usa su clase para reproducir una crisis fechada. La observación y su enlace se conservan.',
    limitations: [
      'La reproducción es una decisión de diseño del escenario, no una reconstrucción física completa.',
      'No se inventan mediciones ausentes ni se traslada una fulguración solar a la superficie lunar como si fuera una medición directa.',
      'La intensidad didáctica no es una dosis ni una tasa de partículas.',
    ],
  },
} as const;

export type ModelId = keyof typeof MODEL_SPECS;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const FLARE_BASE: Record<string, number> = { A: 0, B: 0.02, C: 0.1, M: 0.4, X: 0.75 };
const FLARE_SPAN: Record<string, number> = { A: 0.02, B: 0.08, C: 0.3, M: 0.35, X: 0.25 };

/** Fuerza relativa 0-1 de una clase de fulguración (C1 ≈ 0.13 … X1 ≈ 0.78 … X5+ ≈ 1). */
export function flareStrength(cls: string): number {
  const text = String(cls ?? '').trim().toUpperCase();
  const letter = text.charAt(0);
  const magnitude = Number.parseFloat(text.slice(1));
  const base = FLARE_BASE[letter];
  const span = FLARE_SPAN[letter];
  if (base === undefined || span === undefined || !Number.isFinite(magnitude) || magnitude <= 0) return 0;
  if (letter === 'X' && magnitude >= 5) return 1;
  return clamp01(base + span * Math.min(1, Math.log10(magnitude) / Math.log10(9.9) + 0.1));
}

/** Nivel NOAA S0-S5 a partir del flujo de protones >=10 MeV en pfu. */
export function radiationScale(flux: number): number {
  if (!Number.isFinite(flux) || flux <= 0) return 0;
  if (flux >= 1e5) return 5;
  if (flux >= 1e4) return 4;
  if (flux >= 1e3) return 3;
  if (flux >= 100) return 2;
  if (flux >= 10) return 1;
  return 0;
}

const RADIATION_BANDS = [
  { level: 0, code: 'S0', label: { es: 'Sin tormenta de radiación', en: 'No radiation storm' } },
  { level: 1, code: 'S1', label: { es: 'Tormenta de radiación menor', en: 'Minor radiation storm' } },
  { level: 2, code: 'S2', label: { es: 'Tormenta de radiación moderada', en: 'Moderate radiation storm' } },
  { level: 3, code: 'S3', label: { es: 'Tormenta de radiación fuerte', en: 'Strong radiation storm' } },
  { level: 4, code: 'S4', label: { es: 'Tormenta de radiación severa', en: 'Severe radiation storm' } },
  { level: 5, code: 'S5', label: { es: 'Tormenta de radiación extrema', en: 'Extreme radiation storm' } },
] as const;

export type RadiationBand = (typeof RADIATION_BANDS)[number];

export function radiationBand(scale: number): RadiationBand {
  const level = Number.isFinite(scale) ? Math.min(5, Math.max(0, Math.trunc(scale))) : 0;
  return RADIATION_BANDS[level];
}

export const SOLAR_WIND_MODEL = {
  speed: [[300, 0], [400, 0.15], [500, 0.35], [700, 0.65], [900, 1]],
  density: [[1, 0], [5, 0.1], [10, 0.25], [20, 0.5], [50, 1]],
  densityWeight: 0.25,
} as const;

type Point = readonly [number, number];

function piecewise(value: number, points: readonly Point[]): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (value <= x2) return y1 + ((y2 - y1) * (value - x1)) / (x2 - x1);
  }
  return points[points.length - 1][1];
}

/**
 * Índice didáctico 0-1 del viento solar. Usa velocidad siempre; densidad solo cuando
 * existe una medición verificada. Los puntos de corte están en SOLAR_WIND_MODEL.
 */
export function solarWindIndex(speedKmS: number, densityPerCm3?: number | null): number {
  const speedPart = piecewise(speedKmS, SOLAR_WIND_MODEL.speed);
  if (densityPerCm3 === null || densityPerCm3 === undefined || !Number.isFinite(densityPerCm3)) {
    return clamp01(speedPart);
  }
  const densityPart = piecewise(densityPerCm3, SOLAR_WIND_MODEL.density);
  const weight = SOLAR_WIND_MODEL.densityWeight;
  return clamp01(speedPart * (1 - weight) + densityPart * weight);
}
