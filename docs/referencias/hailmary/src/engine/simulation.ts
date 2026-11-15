import {
  CREW_CONSUMPTION,
  END_THRESHOLDS,
  HARVEST_CYCLES_REQUIRED,
  HARVEST_FOOD_YIELD,
  INITIAL_RESOURCES,
  MAX_CAPACITY,
  MAX_EXPOSURE,
  NASA_SOURCES,
  RADIATION_EFFECTS,
  SOLAR_GENERATION,
  SUBSYSTEM_EFFECTS,
  TOTAL_CYCLES,
} from '../data/scenario';
import type {
  CounterfactualResult,
  CycleBreakdown,
  CycleBreakdownEntry,
  CycleDecision,
  CycleLogEntry,
  CyclePreview,
  DebriefAssessment,
  DebriefReport,
  FailureDetails,
  RadiationLevel,
  Resources,
  SimulationState,
  ValidationResult,
} from './types';

function clampCapacity(value: number): number {
  return Math.min(MAX_CAPACITY, Math.max(0, value));
}

export function createInitialState(attemptNumber = 1): SimulationState {
  return {
    attemptNumber,
    cycle: 1,
    maxCycles: TOTAL_CYCLES,
    resources: { ...INITIAL_RESOURCES },
    cropProgress: 0,
    harvestsCompleted: 0,
    status: 'in_progress',
    failure: null,
    history: [],
  };
}

export function getSolarGeneration(cycle: number): number {
  return cycle === 6 ? SOLAR_GENERATION.cycle6Maintenance : SOLAR_GENERATION.normal;
}

export function getRadiationLevel(cycle: number): RadiationLevel {
  if (cycle === 3) return 'elevated';
  if (cycle === 4) return 'solar_event';
  return 'background';
}

export function getRadiationDelta(cycle: number, protection: CycleDecision['protection']): number {
  if (cycle === 4) {
    return protection === 'shelter'
      ? RADIATION_EFFECTS.cycle4StormWithShelter
      : RADIATION_EFFECTS.cycle4StormNoShelter;
  }
  return RADIATION_EFFECTS.normalCycle;
}

export function isForbiddenCombination(decision: CycleDecision): boolean {
  return (
    decision.protection === 'shelter' &&
    decision.eclss === 'intensive' &&
    decision.greenhouse === 'active'
  );
}

interface StepSimulationResult {
  afterSolarAndCrew: Resources;
  crewSurvivalFailure: FailureDetails | null;
  afterSubsystems: Resources;
  afterProductionAndRadiation: Resources;
  nextCropProgress: number;
  harvested: boolean;
  solarGeneration: number;
  radiationDelta: number;
  radiationLevel: RadiationLevel;
}

function simulateSteps(state: SimulationState, decision: CycleDecision): StepSimulationResult {
  const solarGeneration = getSolarGeneration(state.cycle);
  const radiationDelta = getRadiationDelta(state.cycle, decision.protection);
  const radiationLevel = getRadiationLevel(state.cycle);

  // 1. Generación solar
  const afterSolar: Resources = {
    ...state.resources,
    energy: Math.min(MAX_CAPACITY, state.resources.energy + solarGeneration),
  };

  // 2. Consumo basal de los astronautas
  const rawAfterCrew: Resources = {
    oxygen: afterSolar.oxygen + CREW_CONSUMPTION.oxygen,
    water: afterSolar.water + CREW_CONSUMPTION.water,
    food: afterSolar.food + CREW_CONSUMPTION.food,
    energy: afterSolar.energy + CREW_CONSUMPTION.energy,
    exposure: afterSolar.exposure,
  };

  // 3. Verificación de supervivencia inmediata
  let crewSurvivalFailure: FailureDetails | null = null;
  if (rawAfterCrew.food < 0) {
    crewSurvivalFailure = {
      code: 'food_depleted',
      cycle: state.cycle,
      title: 'Agotamiento de reservas alimentarias',
      explanation:
        'En el ciclo ' +
        state.cycle +
        ', la tripulación requirió 8 unidades de alimentos pero la reserva disponible era insuficiente. Sin cultivo oportuno, la misión no puede continuar.',
    };
  } else if (rawAfterCrew.oxygen < 0) {
    crewSurvivalFailure = {
      code: 'oxygen_depleted',
      cycle: state.cycle,
      title: 'Agotamiento crítico de oxígeno',
      explanation:
        'En el ciclo ' +
        state.cycle +
        ', el consumo basal de 11 unidades de O₂ superó la reserva existente antes de poder activar el soporte vital.',
    };
  } else if (rawAfterCrew.water < 0) {
    crewSurvivalFailure = {
      code: 'water_depleted',
      cycle: state.cycle,
      title: 'Agotamiento crítico de agua',
      explanation:
        'En el ciclo ' +
        state.cycle +
        ', la demanda basal de hidratación (6 u) agotó las reservas de agua potable de la base.',
    };
  } else if (rawAfterCrew.energy < 0) {
    crewSurvivalFailure = {
      code: 'energy_depleted',
      cycle: state.cycle,
      title: 'Colapso energético basal',
      explanation:
        'En el ciclo ' +
        state.cycle +
        ', la generación solar no bastó para sostener el consumo mínimo de hábitat de la tripulación.',
    };
  }

  // 4. Ejecución de los subsistemas configurados
  const eclssEffect = SUBSYSTEM_EFFECTS.eclss[decision.eclss];
  const greenhouseEffect = SUBSYSTEM_EFFECTS.greenhouse[decision.greenhouse];
  const protectionEffect = SUBSYSTEM_EFFECTS.protection[decision.protection];

  const afterSubsystems: Resources = {
    oxygen: Math.min(
      MAX_CAPACITY,
      rawAfterCrew.oxygen + eclssEffect.oxygen + greenhouseEffect.oxygen + protectionEffect.oxygen
    ),
    water: Math.min(
      MAX_CAPACITY,
      rawAfterCrew.water + eclssEffect.water + greenhouseEffect.water + protectionEffect.water
    ),
    food: rawAfterCrew.food,
    energy: Math.min(
      MAX_CAPACITY,
      rawAfterCrew.energy + eclssEffect.energy + greenhouseEffect.energy + protectionEffect.energy
    ),
    exposure: rawAfterCrew.exposure,
  };

  // 5. Producción y cosecha
  let nextCropProgress = state.cropProgress;
  let harvested = false;
  let foodAfterProduction = afterSubsystems.food;

  if (decision.greenhouse === 'active') {
    nextCropProgress = state.cropProgress + 1;
    if (nextCropProgress >= HARVEST_CYCLES_REQUIRED) {
      harvested = true;
      foodAfterProduction = clampCapacity(foodAfterProduction + HARVEST_FOOD_YIELD);
      nextCropProgress = 0;
    }
  }

  // 6. Evento ambiental y radiación
  const afterProductionAndRadiation: Resources = {
    oxygen: clampCapacity(afterSubsystems.oxygen),
    water: clampCapacity(afterSubsystems.water),
    food: clampCapacity(foodAfterProduction),
    energy: clampCapacity(afterSubsystems.energy),
    exposure: afterSubsystems.exposure + radiationDelta,
  };

  return {
    afterSolarAndCrew: rawAfterCrew,
    crewSurvivalFailure,
    afterSubsystems,
    afterProductionAndRadiation,
    nextCropProgress,
    harvested,
    solarGeneration,
    radiationDelta,
    radiationLevel,
  };
}

export function validateDecision(state: SimulationState, decision: CycleDecision): ValidationResult {
  const reasons: string[] = [];
  const insufficientResources: Array<'oxygen' | 'water' | 'energy'> = [];

  if (state.status !== 'in_progress') {
    reasons.push('La misión ya finalizó. Reiniciá para iniciar un nuevo intento.');
    return { valid: false, blockedByRestriction: false, insufficientResources, reasons };
  }

  const blockedByRestriction = isForbiddenCombination(decision);
  if (blockedByRestriction) {
    reasons.push(
      'Restricción operativa: Protocolo Refugio + Electrólisis Intensiva + Cultivo Activo no pueden operar simultáneamente.'
    );
  }

  const sim = simulateSteps(state, decision);

  // Si la tripulación ya no sobrevive al consumo basal (paso 3), permitimos ejecutar para registrar el fallo de misión
  // salvo que exista una restricción operativa explícita o demanda adicional de subsistemas que exceda recursos.
  if (!sim.crewSurvivalFailure) {
    if (sim.afterSubsystems.oxygen < 0) {
      insufficientResources.push('oxygen');
      reasons.push('Oxígeno insuficiente para sostener la configuración seleccionada.');
    }
    if (sim.afterSubsystems.water < 0) {
      insufficientResources.push('water');
      reasons.push(
        `Agua insuficiente tras consumo basal (${sim.afterSolarAndCrew.water} u disponibles) para sostener esta combinación de subsistemas.`
      );
    }
    if (sim.afterSubsystems.energy < 0) {
      insufficientResources.push('energy');
      reasons.push(
        `Energía insuficiente tras consumo basal (${sim.afterSolarAndCrew.energy} u disponibles; faltan ${Math.abs(sim.afterSubsystems.energy)} u).`
      );
    }
  }

  return {
    valid: reasons.length === 0,
    blockedByRestriction,
    insufficientResources,
    reasons,
  };
}

export function previewCycle(state: SimulationState, decision: CycleDecision): CyclePreview {
  const validation = validateDecision(state, decision);
  const sim = simulateSteps(state, decision);

  const projected: Resources = sim.crewSurvivalFailure
    ? {
        oxygen: Math.max(0, sim.afterSolarAndCrew.oxygen),
        water: Math.max(0, sim.afterSolarAndCrew.water),
        food: Math.max(0, sim.afterSolarAndCrew.food),
        energy: Math.max(0, sim.afterSolarAndCrew.energy),
        exposure: state.resources.exposure,
      }
    : sim.afterProductionAndRadiation;

  const deltas: Resources = {
    oxygen: projected.oxygen - state.resources.oxygen,
    water: projected.water - state.resources.water,
    food: projected.food - state.resources.food,
    energy: projected.energy - state.resources.energy,
    exposure: projected.exposure - state.resources.exposure,
  };

  return {
    decision,
    validation,
    projected,
    deltas,
    survivalWarning: sim.crewSurvivalFailure,
    projectedCropProgress: sim.crewSurvivalFailure ? state.cropProgress : sim.nextCropProgress,
    willHarvest: sim.crewSurvivalFailure ? false : sim.harvested,
    solarGeneration: sim.solarGeneration,
    radiationDelta: sim.radiationDelta,
    radiationLevel: sim.radiationLevel,
  };
}

export function getCycleBreakdown(
  state: SimulationState,
  decision: CycleDecision
): CycleBreakdown {
  const sim = simulateSteps(state, decision);
  const start = state.resources;
  const energyAfterSolar = Math.min(MAX_CAPACITY, start.energy + sim.solarGeneration);
  const eclss = SUBSYSTEM_EFFECTS.eclss[decision.eclss];
  const greenhouse = SUBSYSTEM_EFFECTS.greenhouse[decision.greenhouse];
  const protection = SUBSYSTEM_EFFECTS.protection[decision.protection];
  const harvested = !sim.crewSurvivalFailure && sim.harvested;
  const harvestFood = harvested
    ? sim.afterProductionAndRadiation.food - clampCapacity(sim.afterSubsystems.food)
    : 0;
  const end = sim.crewSurvivalFailure
    ? {
        oxygen: Math.max(0, sim.afterSolarAndCrew.oxygen),
        water: Math.max(0, sim.afterSolarAndCrew.water),
        food: Math.max(0, sim.afterSolarAndCrew.food),
        energy: Math.max(0, sim.afterSolarAndCrew.energy),
        exposure: start.exposure,
      }
    : sim.afterProductionAndRadiation;

  const rows: CycleBreakdownEntry[] = (
    ['oxygen', 'water', 'food', 'energy', 'exposure'] as const
  ).map((key) => {
    const solar = key === 'energy' ? energyAfterSolar - start.energy : 0;
    const crew = key === 'exposure' ? 0 : CREW_CONSUMPTION[key];
    const eclssDelta = key === 'exposure' ? 0 : eclss[key];
    const greenhouseDelta = key === 'exposure' ? 0 : greenhouse[key];
    const protectionDelta = key === 'exposure' ? 0 : protection[key];
    const harvest = key === 'food' ? harvestFood : 0;
    const radiation = key === 'exposure' && !sim.crewSurvivalFailure ? sim.radiationDelta : 0;

    return {
      key,
      start: start[key],
      solar,
      crew,
      eclss: eclssDelta,
      greenhouse: greenhouseDelta,
      protection: protectionDelta,
      harvest,
      radiation,
      end: end[key],
      net: end[key] - start[key],
    };
  });

  return {
    cycle: state.cycle,
    rows,
    willHarvest: harvested,
    survivalWarning: sim.crewSurvivalFailure,
  };
}

export function evaluateOutcome(
  resources: Resources,
  cycle: number,
  maxCycles: number
): { status: SimulationState['status']; failure: FailureDetails | null } {
  if (resources.exposure > MAX_EXPOSURE) {
    return {
      status: 'failed',
      failure: {
        code: 'radiation_exceeded',
        cycle,
        title: 'Límite didáctico de exposición superado',
        explanation: `La exposición acumulada alcanzó ${resources.exposure} u (límite didáctico: ${MAX_EXPOSURE} u). En el Ciclo 4, operar sin Protocolo Refugio eleva el índice de riesgo en +35 u.`,
      },
    };
  }

  if (resources.oxygen <= 0) {
    return {
      status: 'failed',
      failure: {
        code: 'oxygen_depleted',
        cycle,
        title: 'Reserva de oxígeno agotada',
        explanation: `El oxígeno cayó a ${resources.oxygen} u al cierre del ciclo ${cycle}.`,
      },
    };
  }

  if (resources.water <= 0) {
    return {
      status: 'failed',
      failure: {
        code: 'water_depleted',
        cycle,
        title: 'Reserva de agua agotada',
        explanation: `El agua cayó a ${resources.water} u al cierre del ciclo ${cycle}.`,
      },
    };
  }

  if (resources.food <= 0) {
    return {
      status: 'failed',
      failure: {
        code: 'food_depleted',
        cycle,
        title: 'Reserva alimentaria agotada',
        explanation: `Los alimentos cayeron a ${resources.food} u al cierre del ciclo ${cycle}.`,
      },
    };
  }

  if (resources.energy <= 0) {
    return {
      status: 'failed',
      failure: {
        code: 'energy_depleted',
        cycle,
        title: 'Reserva energética agotada',
        explanation: `La energía cayó a ${resources.energy} u al cierre del ciclo ${cycle}.`,
      },
    };
  }

  if (cycle >= maxCycles) {
    const deficits: string[] = [];
    if (resources.oxygen < END_THRESHOLDS.oxygen) {
      deficits.push(`Oxígeno (${resources.oxygen} < ${END_THRESHOLDS.oxygen} u)`);
    }
    if (resources.water < END_THRESHOLDS.water) {
      deficits.push(`Agua (${resources.water} < ${END_THRESHOLDS.water} u)`);
    }
    if (resources.food < END_THRESHOLDS.food) {
      deficits.push(`Alimentos (${resources.food} < ${END_THRESHOLDS.food} u)`);
    }
    if (resources.energy < END_THRESHOLDS.energy) {
      deficits.push(`Energía (${resources.energy} < ${END_THRESHOLDS.energy} u)`);
    }

    if (deficits.length > 0) {
      return {
        status: 'failed',
        failure: {
          code: 'final_thresholds_unmet',
          cycle,
          title: 'Umbrales mínimos de cierre no alcanzados',
          explanation: `Lunar Outpost Alpha completó los 7 ciclos, pero cerró por debajo de los mínimos de seguridad para relevo: ${deficits.join(', ')}.`,
        },
      };
    }

    return { status: 'victory', failure: null };
  }

  return { status: 'in_progress', failure: null };
}

function buildCycleSummary(
  decision: CycleDecision,
  harvested: boolean,
  radiationDelta: number,
  cycle: number
): { summary: string; scientificNote: string } {
  const eclssLabel = decision.eclss === 'intensive' ? 'Electrólisis intensiva' : 'ECLSS nominal';
  const ghLabel =
    decision.greenhouse === 'active'
      ? harvested
        ? 'Cultivo activo (Cosecha +32 u)'
        : 'Cultivo activo (Progreso 1/2)'
      : 'Invernadero en espera/latencia';
  const protLabel = decision.protection === 'shelter' ? 'Protocolo Refugio' : 'Operación normal';

  const summary = `${eclssLabel} · ${ghLabel} · ${protLabel} (Rad +${radiationDelta} u).`;

  let scientificNote =
    'El sistema ECLSS recicla agua y estabiliza el O₂, pero cada unidad didáctica de energía asignada compite con el resto de la base.';
  if (cycle === 4) {
    scientificNote =
      decision.protection === 'shelter'
        ? 'El refugio redujo el impacto de la tormenta solar de +35 u a +8 u manteniendo la latencia del cultivo.'
        : 'Sin refugio ante el evento solar, las partículas energéticas dispararon la exposición acumulada (+35 u).';
  } else if (harvested) {
    scientificNote =
      'En este modelo, el cultivo requiere 2 ciclos activos con agua y energía antes de entregar alimentos utilizables.';
  } else if (cycle === 6) {
    scientificNote =
      'Durante el mantenimiento solar (+7 u), las reservas energéticas acumuladas sostuvieron la operación.';
  }

  return { summary, scientificNote };
}

export function advanceCycle(state: SimulationState, decision: CycleDecision): SimulationState {
  const validation = validateDecision(state, decision);
  if (!validation.valid) {
    throw new Error(validation.reasons.join(' '));
  }

  const sim = simulateSteps(state, decision);
  const before = { ...state.resources };

  // Si falla la supervivencia basal en el paso 3
  if (sim.crewSurvivalFailure) {
    const clampedAfter: Resources = {
      oxygen: Math.max(0, sim.afterSolarAndCrew.oxygen),
      water: Math.max(0, sim.afterSolarAndCrew.water),
      food: Math.max(0, sim.afterSolarAndCrew.food),
      energy: Math.max(0, sim.afterSolarAndCrew.energy),
      exposure: state.resources.exposure,
    };

    const entry: CycleLogEntry = {
      cycle: state.cycle,
      decision: { ...decision },
      before,
      after: clampedAfter,
      solarGeneration: sim.solarGeneration,
      radiationDelta: 0,
      radiationLevel: sim.radiationLevel,
      cropProgressBefore: state.cropProgress,
      cropProgressAfter: state.cropProgress,
      harvested: false,
      summary: `Fallo en verificación de supervivencia basal: ${sim.crewSurvivalFailure.title}.`,
      scientificNote: sim.crewSurvivalFailure.explanation,
    };

    return {
      ...state,
      resources: clampedAfter,
      status: 'failed',
      failure: sim.crewSurvivalFailure,
      history: [...state.history, entry],
    };
  }

  const after = sim.afterProductionAndRadiation;
  const { summary, scientificNote } = buildCycleSummary(
    decision,
    sim.harvested,
    sim.radiationDelta,
    state.cycle
  );

  const entry: CycleLogEntry = {
    cycle: state.cycle,
    decision: { ...decision },
    before,
    after,
    solarGeneration: sim.solarGeneration,
    radiationDelta: sim.radiationDelta,
    radiationLevel: sim.radiationLevel,
    cropProgressBefore: state.cropProgress,
    cropProgressAfter: sim.nextCropProgress,
    harvested: sim.harvested,
    summary,
    scientificNote,
  };

  const outcome = evaluateOutcome(after, state.cycle, state.maxCycles);
  const nextCycle =
    outcome.status === 'in_progress' ? Math.min(state.maxCycles, state.cycle + 1) : state.cycle;

  return {
    ...state,
    cycle: nextCycle,
    resources: after,
    cropProgress: sim.nextCropProgress,
    harvestsCompleted: state.harvestsCompleted + (sim.harvested ? 1 : 0),
    status: outcome.status,
    failure: outcome.failure,
    history: [...state.history, entry],
  };
}

function sameDecision(a: CycleDecision, b: CycleDecision): boolean {
  return a.eclss === b.eclss && a.greenhouse === b.greenhouse && a.protection === b.protection;
}

export function buildCounterfactual(
  state: SimulationState,
  cycle: number,
  patch: Partial<CycleDecision>
): CounterfactualResult | null {
  const target = state.history.find((entry) => entry.cycle === cycle);
  if (!target) return null;

  const changed: CycleDecision = { ...target.decision, ...patch };
  if (sameDecision(changed, target.decision)) return null;

  let replay = createInitialState(state.attemptNumber);
  try {
    for (const entry of state.history) {
      if (replay.status !== 'in_progress') break;
      const decision = entry.cycle === cycle ? changed : entry.decision;
      replay = advanceCycle(replay, decision);
    }
  } catch {
    return null;
  }

  const alternative = {
    status: replay.status,
    exposure: replay.resources.exposure,
    failureCode: replay.failure?.code ?? null,
    cyclesCompleted: replay.history.length,
  };
  const actual = {
    status: state.status,
    exposure: state.resources.exposure,
    failureCode: state.failure?.code ?? null,
    cyclesCompleted: state.history.length,
  };

  let summary: string;
  if (alternative.status === 'victory') {
    summary = `La variante habría completado la misión con ${alternative.exposure} u de exposición.`;
  } else if (alternative.failureCode === 'radiation_exceeded') {
    summary = `La variante habría superado el límite de exposición: ${alternative.exposure} u y fallo en el ciclo ${cycle}.`;
  } else if (alternative.failureCode) {
    summary = `La variante habría fallado por ${alternative.failureCode} en el ciclo ${cycle}.`;
  } else {
    summary = 'La variante no habría cambiado el resultado de la misión.';
  }

  return {
    cycle,
    summary,
    actual,
    alternative,
    differs:
      alternative.status !== actual.status ||
      alternative.exposure !== actual.exposure ||
      alternative.failureCode !== actual.failureCode,
  };
}

export function buildDebrief(state: SimulationState): DebriefReport {
  const status = state.status === 'victory' ? 'victory' : 'failed';
  const intensiveCount = state.history.filter((h) => h.decision.eclss === 'intensive').length;
  const cycle4Entry = state.history.find((h) => h.cycle === 4);

  const lifeSupportRating: DebriefAssessment['rating'] =
    state.resources.oxygen >= END_THRESHOLDS.oxygen &&
    state.resources.water >= END_THRESHOLDS.water &&
    intensiveCount >= 1
      ? 'optimal'
      : state.resources.oxygen > 0 && state.resources.water > 0
        ? 'adequate'
        : 'critical';

  const foodRating: DebriefAssessment['rating'] =
    state.harvestsCompleted >= 1 && state.resources.food >= END_THRESHOLDS.food
      ? 'optimal'
      : state.resources.food > 0
        ? 'adequate'
        : 'critical';

  const radiationRating: DebriefAssessment['rating'] =
    state.resources.exposure <= MAX_EXPOSURE && cycle4Entry?.decision.protection === 'shelter'
      ? 'optimal'
      : state.resources.exposure <= MAX_EXPOSURE
        ? 'adequate'
        : 'critical';

  const assessments: DebriefAssessment[] = [
    {
      id: 'life_support',
      title: 'Gestión de Soporte Vital (Agua y O₂)',
      rating: lifeSupportRating,
      finding: `Usaste Electrólisis Intensiva en ${intensiveCount} ciclo(s). Cierre: ${state.resources.oxygen} u de O₂ y ${state.resources.water} u de Agua.`,
      scientificExplanation:
        'ECLSS recupera agua y genera oxígeno mediante electrólisis, que requiere agua y energía. En este modelo didáctico, el modo nominal no basta por sí solo durante 7 ciclos; sus cifras no representan rendimiento operacional real.',
      source: NASA_SOURCES.eclss,
    },
    {
      id: 'food_strategy',
      title: 'Estrategia Alimentaria e Invernadero',
      rating: foodRating,
      finding: `Completaste ${state.harvestsCompleted} cosecha(s). Reserva final de alimentos: ${state.resources.food} u.`,
      scientificExplanation:
        'Las plantas requieren agua, luz y tiempo para producir alimento. Los 2 ciclos activos y la conservación del progreso en latencia son simplificaciones de este modelo; no representan tiempos reales de cultivo.',
      source: NASA_SOURCES.plants,
    },
    {
      id: 'radiation_response',
      title: 'Respuesta a Radiación y Tormenta Solar',
      rating: radiationRating,
      finding: cycle4Entry
        ? `En el Ciclo 4 elegiste ${cycle4Entry.decision.protection === 'shelter' ? 'Protocolo Refugio (+8 u)' : 'Operación Normal (+35 u)'}. Exposición total: ${state.resources.exposure} u.`
        : `La misión concluyó antes del Ciclo 4 con ${state.resources.exposure} u de exposición acumulada.`,
      scientificExplanation:
        'Un evento SPE aumenta la exposición de forma abrupta. El refugio la reduce parcialmente; la radiación galáctica de fondo (GCR) permanece. Los valores son unidades didácticas, no dosis médicas; el intercambio es energía operativa.',
      source: NASA_SOURCES.shielding,
    },
  ];

  const headline =
    status === 'victory'
      ? 'Misión Cumplida — Lunar Outpost Alpha Estabilizada'
      : `Misión Fallida en Ciclo ${state.failure?.cycle ?? state.cycle} — ${state.failure?.title ?? 'Colapso Operativo'}`;

  const summary =
    status === 'victory'
      ? 'Mantuviste los cuatro pilares de supervivencia por encima de los umbrales de seguridad tras 7 ciclos operativos y mitigaste la tormenta solar del Ciclo 4.'
      : state.failure?.explanation ??
        'Uno o más sistemas críticos cayeron fuera del rango operativo permitido.';

  const keyTakeaways = [
    'Producir oxígeno mediante electrólisis depende directamente de tener agua y energía disponibles.',
    'La agricultura lunar exige planificación anticipada y gestión de latencia ante emergencias.',
    'Ante un evento de partículas solares, proteger a la tripulación obliga a sacrificar capacidad operativa temporalmente.',
  ];

  return {
    status,
    headline,
    summary,
    cyclesCompleted: state.history.length,
    finalResources: { ...state.resources },
    harvestsCompleted: state.harvestsCompleted,
    assessments,
    keyTakeaways,
  };
}
