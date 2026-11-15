import { describe, expect, it } from 'vitest';
import {
  countFlares,
  flareStrength,
  historicalMissionScenario,
  loadSpaceWeather,
  loadTelemetry,
  parseDonkiFlares,
  parseGoesProtons,
  parseRtswTail,
  parseSolarWindSpeed,
  radiationBand,
  radiationScale,
  snapshotTelemetry,
  solarWindIndex,
  strongestFlare,
  telemetryFromLive,
  type TelemetryFetcher,
} from './spaceweather';
import { MODEL_SPECS } from './models';

const NOW = new Date('2026-11-15T12:00:00Z');

describe('modelos explícitos y documentados', () => {
  it('declara modelos con título, tipo y limitaciones, sin relaciones científicas falsas', () => {
    expect(MODEL_SPECS['nexus.flare-class.v1'].kind).toBe('didactic');
    expect(MODEL_SPECS['nexus.noaa-s-scale.v1'].kind).toBe('official');
    expect(MODEL_SPECS['nexus.imo-meteor-calendar.v1'].kind).toBe('prediction');
    expect(MODEL_SPECS['nexus.historical-flare.v1'].limitations.length).toBeGreaterThan(1);
    expect(MODEL_SPECS['nexus.solar-wind-index.v1'].limitations.join(' ')).toMatch(/no existe una escala NOAA oficial/i);
  });

  it('convierte clases de fulguración a intensidad didáctica 0-1 y rechaza clases inválidas', () => {
    expect(flareStrength('C1.0')).toBeGreaterThan(0.1);
    expect(flareStrength('C1.0')).toBeLessThan(flareStrength('M1.0'));
    expect(flareStrength('M1.0')).toBeLessThan(flareStrength('X1.0'));
    expect(flareStrength('X5.0')).toBeCloseTo(1, 5);
    expect(flareStrength('')).toBe(0);
    expect(flareStrength('Z9')).toBe(0);
  });

  it('aplica los umbrales NOAA S1-S5 al flujo de protones >=10 MeV', () => {
    expect(radiationScale(0.2)).toBe(0);
    expect(radiationScale(9.99)).toBe(0);
    expect(radiationScale(10)).toBe(1);
    expect(radiationScale(100)).toBe(2);
    expect(radiationScale(1_000)).toBe(3);
    expect(radiationScale(10_000)).toBe(4);
    expect(radiationScale(100_000)).toBe(5);
    expect(radiationScale(Number.NaN)).toBe(0);
    expect(radiationBand(3).code).toBe('S3');
  });

  it('calcula índice de viento solar solo con mediciones verificadas (velocidad y densidad opcional)', () => {
    const onlySpeed = solarWindIndex(700);
    const withDensity = solarWindIndex(700, 20);
    expect(onlySpeed).toBeGreaterThan(0);
    expect(onlySpeed).toBeLessThanOrEqual(1);
    expect(withDensity).toBeGreaterThan(0);
    expect(solarWindIndex(350)).toBeLessThan(solarWindIndex(700));
    expect(solarWindIndex(700, null)).toBe(onlySpeed);
    expect(solarWindIndex(700, undefined)).toBe(onlySpeed);
  });
});

describe('parsers de fuentes verificables', () => {
  it('parsea fulguraciones DONKI conservando id, pico UTC, clase y enlace; ignora registros incompletos', () => {
    const flares = parseDonkiFlares([
      { flrID: 'A', peakTime: '2026-11-10T10:00Z', classType: 'M2.0', link: 'https://x/1' },
      { flrID: 'B', beginTime: '2026-11-10T09:00Z', classType: 'C1.2' },
      { flrID: 'bad', peakTime: '2026-11-10T10:00Z' },
      { flrID: 'bad2', peakTime: '2026-11-10T10:00Z', classType: '??' },
    ]);
    expect(flares).toHaveLength(2);
    expect(flares[0]).toMatchObject({ id: 'B', peak: '2026-11-10T09:00:00.000Z', class: 'C1.2' });
    expect(flares[1].link).toBe('https://x/1');
  });

  it('cuenta actividad C/M/X y selecciona la fulguración más fuerte', () => {
    const flares = parseDonkiFlares([
      { flrID: 'c', peakTime: '2026-11-10T10:00Z', classType: 'C3.0', link: '' },
      { flrID: 'm', peakTime: '2026-11-10T11:00Z', classType: 'M1.0', link: '' },
      { flrID: 'x', peakTime: '2026-11-10T12:00Z', classType: 'X1.2', link: '' },
    ]);
    expect(countFlares(flares)).toEqual({ c: 1, m: 1, x: 1 });
    expect(strongestFlare(flares)?.id).toBe('x');
  });

  it('toma la última medición GOES >=10 MeV y la clasifica en la escala NOAA S', () => {
    const reading = parseGoesProtons([
      { time_tag: '2026-11-15T10:00:00Z', satellite: 18, flux: 0.2, energy: '>=1 MeV' },
      { time_tag: '2026-11-15T10:00:00Z', satellite: 18, flux: 0.5, energy: '>=10 MeV' },
      { time_tag: '2026-11-15T10:05:00Z', satellite: 18, flux: 12, energy: '>=10 MeV' },
    ]);
    expect(reading?.utc).toBe('2026-11-15T10:05:00.000Z');
    expect(reading?.proton).toMatchObject({ flux: 12, energy: '>=10 MeV', scale: 1, band: 'S1', satellite: 18 });
  });

  it('parsea velocidad verificada del viento solar y cola RTSW (con rango HTTP) sin inventar datos', () => {
    const speed = parseSolarWindSpeed([
      { time_tag: '2026-11-15T10:00:00Z', proton_speed: 360 },
      { time_tag: '2026-11-15T10:05:00Z', proton_speed: 410 },
    ]);
    expect(speed).toMatchObject({ speedKmS: 410, utc: '2026-11-15T10:05:00.000Z' });

    const tail = 'garbage {"time_tag":"2026-11-15T10:04:00","active":false,"source":"ACE","proton_speed":405,"proton_density":3.1,"proton_temperature":34000} {"time_tag":"2026-11-15T10:05:00","active":true,"source":"SOLAR1","proton_speed":398,"proton_density":1.6,"proton_temperature":55000}';
    const rtsw = parseRtswTail(tail);
    expect(rtsw).toMatchObject({ speedKmS: 398, densityPerCm3: 1.6, spacecraft: 'SOLAR1', utc: '2026-11-15T10:05:00.000Z' });
  });
});

describe('modelo normalizado, procedencia y degradación', () => {
  it('usa snapshot fechado sin conexión y marca claramente que no es LIVE', () => {
    const telemetry = snapshotTelemetry(NOW);
    expect(telemetry.solarActivity.status).toBe('SNAPSHOT');
    expect(telemetry.protons.status).toBe('SNAPSHOT');
    expect(telemetry.solarWind.status).toBe('UNAVAILABLE');
    expect(telemetry.fetchedAt).toBe('2026-11-14T22:59:00.000Z');
    expect(telemetry.solarActivity.utc).toBe('2026-11-14T22:59:00.000Z');
    expect(telemetry.solarActivity.note).toMatch(/Snapshot/i);
    expect(telemetry.solarActivity.lunarRelevance).toBe('remote-observation');
    expect(telemetry.protons.lunarRelevance).toBe('earth-orbit-proxy');
    expect(telemetry.solarWind.lunarRelevance).toBe('upstream-proxy');
    expect(telemetry.solarWind.value).toBeNull();
  });

  it('cada dato incluye fuente, hora UTC, antigüedad, lugar, calidad y estado; nada se presenta como superficie lunar', () => {
    const telemetry = snapshotTelemetry(NOW);
    for (const datum of [telemetry.solarActivity, telemetry.protons, telemetry.solarWind]) {
      expect(datum.source.name.length).toBeGreaterThan(0);
      expect(datum.source.url).toMatch(/^https:\/\//);
      expect(datum.location.length).toBeGreaterThan(0);
      expect(['LIVE', 'SNAPSHOT', 'UNAVAILABLE']).toContain(datum.status);
      expect(['verified', 'stale', 'predicted', 'unknown']).toContain(datum.quality);
      expect(['observation', 'prediction']).toContain(datum.nature);
      expect(datum.lunarRelevance).not.toBe('direct-measurement');
      expect(datum.note).not.toMatch(/superficie lunar.*medici/i);
    }
  });

  it('construye telemetría LIVE por fuente: actividad C/M/X, radiación NOAA y viento solar verificado en L1', () => {
    const telemetry = telemetryFromLive(
      {
        flares: [
          { flrID: 'c1', peakTime: '2026-11-15T08:00Z', classType: 'C2.0', link: 'https://a' },
          { flrID: 'm1', peakTime: '2026-11-15T09:00Z', classType: 'M1.3', link: 'https://b' },
          { flrID: 'x1', peakTime: '2026-11-15T10:00Z', classType: 'X1.0', link: 'https://c' },
        ],
        protons: [
          { time_tag: '2026-11-15T11:55:00Z', satellite: 18, flux: 120, energy: '>=10 MeV' },
        ],
        solarWindSpeed: [{ time_tag: '2026-11-15T11:56:00Z', proton_speed: 520 }],
        solarWindTail:
          '[{"time_tag":"2026-11-15T11:56:00","active":true,"source":"SOLAR1","proton_speed":520,"proton_density":8.5,"proton_temperature":90000}]',
      },
      NOW,
      30,
    );

    expect(telemetry.status).toBe('LIVE');
    expect(telemetry.solarActivity.status).toBe('LIVE');
    expect(telemetry.solarActivity.value?.counts).toEqual({ c: 1, m: 1, x: 1 });
    expect(telemetry.solarActivity.value?.strongest?.class).toBe('X1.0');
    expect(telemetry.solarActivity.value?.last24h.counts).toEqual({ c: 1, m: 1, x: 1 });
    expect(telemetry.protons.value).toMatchObject({ flux: 120, scale: 2, band: 'S2' });
    expect(telemetry.protons.note).toMatch(/no una medición de la superficie lunar/i);
    expect(telemetry.solarWind.status).toBe('LIVE');
    expect(telemetry.solarWind.value).toMatchObject({ speedKmS: 520, densityPerCm3: 8.5, spacecraft: 'SOLAR1' });
    expect(telemetry.solarWind.location).toMatch(/L1/i);
    expect(telemetry.solarWind.note).toMatch(/aguas arriba|no son mediciones/i);
  });

  it('si falla una fuente la degradación es por fuente y nunca inventa mediciones', async () => {
    const failing: TelemetryFetcher = {
      json: async () => {
        throw new Error('offline');
      },
      text: async () => {
        throw new Error('offline');
      },
    };
    const telemetry = await loadTelemetry(NOW, failing);
    expect(telemetry.solarActivity.status).toBe('SNAPSHOT');
    expect(telemetry.protons.status).toBe('SNAPSHOT');
    expect(telemetry.solarWind.status).toBe('UNAVAILABLE');
    expect(telemetry.solarWind.value).toBeNull();
    expect(telemetry.solarWind.note).toMatch(/No se inventa/i);
  });

  it('si hay velocidad pero no densidad verificada, reporta velocidad y marca densidad no disponible', () => {
    const telemetry = telemetryFromLive(
      {
        protons: [{ time_tag: '2026-11-15T11:55:00Z', satellite: 18, flux: 0.2, energy: '>=10 MeV' }],
        solarWindSpeed: [{ time_tag: '2026-11-15T11:56:00Z', proton_speed: 480 }],
        solarWindTail: '',
      },
      NOW,
    );
    expect(telemetry.solarWind.status).toBe('LIVE');
    expect(telemetry.solarWind.value?.speedKmS).toBe(480);
    expect(telemetry.solarWind.value?.densityPerCm3).toBeNull();
    expect(telemetry.solarWind.note).toMatch(/densidad no disponible/i);
  });
});

describe('meteoros IMO y escenarios históricos reproducibles', () => {
  it('reporta actividad prevista de meteoros como predicción, no como medición de impactos lunares', () => {
    const telemetry = snapshotTelemetry(new Date('2026-12-14T12:00:00Z'));
    expect(telemetry.meteors.status).toBe('SNAPSHOT');
    expect(telemetry.meteors.quality).toBe('predicted');
    expect(telemetry.meteors.nature).toBe('prediction');
    expect(telemetry.meteors.lunarRelevance).toBe('prediction');
    expect(telemetry.meteors.value?.active).toBe(true);
    expect(telemetry.meteors.value?.shower?.id).toBe('GEM');
    expect(telemetry.meteors.note).toMatch(/predicción|predicci/i);
    expect(telemetry.meteors.note).toMatch(/no medición de impactos lunares/i);
  });

  it('genera un escenario histórico reproducible desde observaciones reales del snapshot', () => {
    const a = historicalMissionScenario(NOW);
    const b = historicalMissionScenario(NOW);
    expect(a).toEqual(b);
    expect(a.flare.id.length).toBeGreaterThan(0);
    expect(a.flare.peak).toMatch(/Z$/);
    expect(a.flare.link).toMatch(/^https:\/\//);
    expect(a.totalFlares).toBeGreaterThan(0);
    expect(a.counts.c + a.counts.m + a.counts.x).toBeGreaterThan(0);
    expect(a.strength).toBeGreaterThan(0);
    expect(a.snapshot.status).toBe('SNAPSHOT');
    expect(a.signal.model).toBe('nexus.historical-flare.v1');
    expect(['observation', 'estimation', 'prediction', 'simulation']).toContain(a.signal.kind);
    expect(a.signal.lunarRelation).not.toBe('direct-measurement');
    expect(a.signal.observedAtLocation).toMatch(/Sol|órbita|observaci/i);
    expect(a.signal.note).toMatch(/observaci|derivaci|didáctica/i);
  });

  it('mantiene compatibilidad de spaceweather y expone snapshot fechado', async () => {
    const compat = await loadSpaceWeather(NOW);
    expect(typeof compat.live).toBe('boolean');
    expect(compat.fetchedAt.length).toBeGreaterThan(0);
    expect(Array.isArray(compat.flares)).toBe(true);
    expect(typeof compat.protons.flux).toBe('number');
  });
});
