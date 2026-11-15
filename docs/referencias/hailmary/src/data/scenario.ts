import type { NasaSource, RadiationLevel, ResourceKey, Resources } from '../engine/types';

export const TOTAL_CYCLES = 7;
export const MAX_CAPACITY = 100;
export const MAX_EXPOSURE = 40;
export const HARVEST_CYCLES_REQUIRED = 2;
export const HARVEST_FOOD_YIELD = 32;

export const INITIAL_RESOURCES: Resources = {
  oxygen: 51,
  water: 77,
  food: 44,
  energy: 70,
  exposure: 0,
};

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  oxygen: 'Oxígeno',
  water: 'Agua',
  food: 'Alimentos',
  energy: 'Energía',
  exposure: 'Exposición',
};

export const END_THRESHOLDS = {
  oxygen: 15,
  water: 15,
  food: 8,
  energy: 10,
  exposure: MAX_EXPOSURE,
} as const;

export const CREW_CONSUMPTION = {
  oxygen: -11,
  water: -6,
  food: -8,
  energy: -7,
} as const;

export const SOLAR_GENERATION = {
  normal: 19,
  cycle6Maintenance: 7,
} as const;

export const SUBSYSTEM_EFFECTS = {
  eclss: {
    nominal: { oxygen: 4, water: 3, food: 0, energy: -9 },
    intensive: { oxygen: 18, water: -8, food: 0, energy: -19 },
  },
  greenhouse: {
    standby: { oxygen: 0, water: 0, food: 0, energy: -2 },
    active: { oxygen: 0, water: -7, food: 0, energy: -13 },
  },
  protection: {
    normal: { oxygen: 0, water: 0, food: 0, energy: 0 },
    shelter: { oxygen: 0, water: 0, food: 0, energy: -10 },
  },
} as const;

export const RADIATION_EFFECTS = {
  normalCycle: 3,
  cycle4StormNoShelter: 35,
  cycle4StormWithShelter: 8,
} as const;

export interface CycleContextInfo {
  cycle: number;
  title: string;
  briefing: string;
  radiationLevel: RadiationLevel;
  radiationForecast: string;
  solarOutput: number;
  alertTag?: string;
}

export const CYCLE_CONTEXT: Record<number, CycleContextInfo> = {
  1: {
    cycle: 1,
    title: 'Estabilización de soporte vital',
    briefing:
      'Lunar Outpost Alpha inicia operaciones nominales con dos tripulantes. Supervisá el consumo basal y evaluá cuándo iniciar la producción agrícola.',
    radiationLevel: 'background',
    radiationForecast: 'Radiación GCR de fondo estable (+3 u/ciclo).',
    solarOutput: SOLAR_GENERATION.normal,
  },
  2: {
    cycle: 2,
    title: 'Balance hídrico y oxígeno',
    briefing:
      'La tripulación consume reservas de forma continua. Producir oxígeno por electrólisis intensiva consume agua y energía que también requiere el invernadero.',
    radiationLevel: 'background',
    radiationForecast: 'Radiación GCR de fondo estable (+3 u/ciclo).',
    solarOutput: SOLAR_GENERATION.normal,
  },
  3: {
    cycle: 3,
    title: 'Alerta temprana de partículas solares',
    briefing:
      'Sensores heliogeofísicos detectan una eyección solar dirigida al entorno lunar para el Ciclo 4. Asegurá reservas de oxígeno y energía antes de activar el refugio.',
    radiationLevel: 'elevated',
    radiationForecast: 'ALERTA: Evento SPE previsto para el Ciclo 4.',
    solarOutput: SOLAR_GENERATION.normal,
    alertTag: 'ALERTA TEMPRANA SOLAR',
  },
  4: {
    cycle: 4,
    title: 'Evento de partículas solares (SPE)',
    briefing:
      'Tormenta de partículas solares activa sobre el polo sur lunar. Activar el Protocolo Refugio reduce drásticamente la exposición (+8 u vs +35 u), pero restringe la energía operativa.',
    radiationLevel: 'solar_event',
    radiationForecast: 'SPE ACTIVA: +35 u sin refugio / +8 u en Protocolo Refugio.',
    solarOutput: SOLAR_GENERATION.normal,
    alertTag: 'EVENTO SOLAR CRÍTICO',
  },
  5: {
    cycle: 5,
    title: 'Recuperación post-tormenta',
    briefing:
      'El flujo de partículas retorna a niveles de fondo. Si iniciaste el cultivo previamente, podés completar el segundo ciclo activo para cosechar 32 u de alimentos.',
    radiationLevel: 'background',
    radiationForecast: 'Radiación GCR de fondo estable (+3 u/ciclo).',
    solarOutput: SOLAR_GENERATION.normal,
  },
  6: {
    cycle: 6,
    title: 'Mantenimiento del arreglo solar',
    briefing:
      'Desconexión parcial programada en los paneles solares: la generación cae de +19 u a +7 u en este ciclo. Administrá tus reservas acumuladas con prudencia.',
    radiationLevel: 'background',
    radiationForecast: 'Radiación GCR de fondo estable (+3 u/ciclo).',
    solarOutput: SOLAR_GENERATION.cycle6Maintenance,
    alertTag: 'GENERACIÓN SOLAR REDUCIDA (+7 u)',
  },
  7: {
    cycle: 7,
    title: 'Cierre y estabilización final',
    briefing:
      'Último ciclo de la misión. Al concluir, Lunar Outpost Alpha debe mantener al menos 15 O₂, 15 Agua, 8 Alimentos, 10 Energía y un índice de exposición <= 40.',
    radiationLevel: 'background',
    radiationForecast: 'Radiación GCR de fondo estable (+3 u/ciclo).',
    solarOutput: SOLAR_GENERATION.normal,
  },
};

export const NASA_SOURCES: Record<string, NasaSource> = {
  eclss: {
    title: 'NASA — Environmental Control and Life Support Systems (ECLSS)',
    url: 'https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/',
    topic: 'Reciclaje de agua, electrólisis de oxígeno e interdependencia de sistemas.',
  },
  radiation: {
    title: 'NASA — About the Space Radiation Element',
    url: 'https://www.nasa.gov/reference/about-the-space-radiation-element/',
    topic: 'Diferencia entre radiación cósmica galáctica de fondo y eventos de partículas solares.',
  },
  shielding: {
    title: 'NASA Langley — Radiation Analysis and Shielding Design',
    url: 'https://ddtrb.larc.nasa.gov/radiation/',
    topic: 'Blindaje físico, refugios y mitigación parcial de exposición.',
  },
  plants: {
    title: 'NASA — Growing Plants in Space',
    url: 'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/',
    topic: 'Cultivos en ambientes controlados, consumo hídrico y producción diferida.',
  },
  plantsChallenges: {
    title: 'NASA Science — Challenges of Growing Plants in Space',
    url: 'https://science.nasa.gov/biological-physical/the-challenges-of-growing-plants-in-space/',
    topic: 'Limitaciones energéticas y ambientales en agricultura lunar.',
  },
  moonBase: {
    title: 'NASA — Moon Base Systems',
    url: 'https://www.nasa.gov/moonbase-systems/',
    topic: 'Infraestructura de hábitat y generación energética en superficie lunar.',
  },
};
