import { describe, expect, it } from 'vitest';
import {
  advanceCycle,
  buildCounterfactual,
  buildDebrief,
  createInitialState,
  getCycleBreakdown,
  previewCycle,
  validateDecision,
} from './simulation';
import type { CycleDecision, SimulationState } from './types';
import { loadSession, saveSession, type StorageAdapter } from '../storage/persistence';

const NOMINAL_STANDBY_NORMAL: CycleDecision = {
  eclss: 'nominal',
  greenhouse: 'standby',
  protection: 'normal',
};

describe('NEXUS Motor de Simulación Determinista V1.0', () => {
  it('completa la estrategia de aceptación de 7 ciclos con los valores exactos esperados', () => {
    const plan: CycleDecision[] = [
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C1
      { eclss: 'intensive', greenhouse: 'standby', protection: 'normal' }, // C2
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' }, // C3
      { eclss: 'nominal', greenhouse: 'standby', protection: 'shelter' }, // C4
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' }, // C5
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C6
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C7
    ];

    let state = createInitialState();
    for (const decision of plan) {
      state = advanceCycle(state, decision);
    }

    expect(state.status).toBe('victory');
    expect(state.failure).toBeNull();
    expect(state.history).toHaveLength(7);
    expect(state.harvestsCompleted).toBe(1);
    expect(state.resources).toEqual({
      oxygen: 16,
      water: 31,
      food: 20,
      energy: 23,
      exposure: 26,
    });

    const debrief = buildDebrief(state);
    expect(debrief.status).toBe('victory');
    expect(debrief.assessments).toHaveLength(3);
  });

  it('falla por falta de alimentos cuando no se activa el invernadero', () => {
    let state = createInitialState();
    // C1-C5: sin cultivo, comida pasa 44 -> 36 -> 28 -> 20 -> 12 -> 4
    // En C4 usamos refugio para no morir antes por radiación
    const decisions: CycleDecision[] = [
      NOMINAL_STANDBY_NORMAL,
      NOMINAL_STANDBY_NORMAL,
      NOMINAL_STANDBY_NORMAL,
      { eclss: 'nominal', greenhouse: 'standby', protection: 'shelter' },
      NOMINAL_STANDBY_NORMAL,
      NOMINAL_STANDBY_NORMAL, // C6: requiere 8 comida, solo hay 4
    ];

    for (const d of decisions) {
      if (state.status === 'in_progress') {
        state = advanceCycle(state, d);
      }
    }

    expect(state.status).toBe('failed');
    expect(state.failure?.code).toBe('food_depleted');
    expect(state.failure?.cycle).toBe(6);
    expect(state.resources.food).toBe(0);
  });

  it('falla al finalizar el ciclo 7 por insuficiencia de oxígeno si no se usa electrólisis intensiva', () => {
    const plan: CycleDecision[] = [
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C1
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C2 (sin intensivo)
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' }, // C3
      { eclss: 'nominal', greenhouse: 'standby', protection: 'shelter' }, // C4
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' }, // C5
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C6
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C7: 9 O2 - 11 crew < 0
    ];

    let state = createInitialState();
    for (const d of plan) {
      state = advanceCycle(state, d);
    }

    expect(state.status).toBe('failed');
    expect(state.failure?.code).toBe('oxygen_depleted');
    expect(state.failure?.cycle).toBe(7);
    expect(state.resources.oxygen).toBe(0);
  });

  it('falla al cierre del ciclo 7 si los recursos quedan por debajo de los umbrales mínimos de relevo', () => {
    // Usar intensivo en C2, cosechar en C3+C5, pero gastar energía extra en C6 y C7 para cerrar < 10 energía
    const plan: CycleDecision[] = [
      { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' }, // C1
      { eclss: 'intensive', greenhouse: 'standby', protection: 'normal' }, // C2
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' }, // C3
      { eclss: 'nominal', greenhouse: 'standby', protection: 'shelter' }, // C4
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' }, // C5: E=33
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' }, // C6: +7 -7 -9 -13 = 11
      { eclss: 'intensive', greenhouse: 'standby', protection: 'normal' }, // C7: +19 -7 -19 -2 = 2 (< 10)
    ];

    let state = createInitialState();
    for (const d of plan) {
      state = advanceCycle(state, d);
    }

    expect(state.status).toBe('failed');
    expect(state.failure?.code).toBe('final_thresholds_unmet');
    expect(state.resources.energy).toBeLessThan(10);
  });

  it('falla por exposición excesiva si se ignora el refugio durante la tormenta solar del ciclo 4', () => {
    let state = createInitialState();
    state = advanceCycle(state, NOMINAL_STANDBY_NORMAL); // C1: exp 3
    state = advanceCycle(state, NOMINAL_STANDBY_NORMAL); // C2: exp 6
    state = advanceCycle(state, NOMINAL_STANDBY_NORMAL); // C3: exp 9
    state = advanceCycle(state, NOMINAL_STANDBY_NORMAL); // C4 sin refugio: +35 -> 44 > 40

    expect(state.status).toBe('failed');
    expect(state.failure?.code).toBe('radiation_exceeded');
    expect(state.failure?.cycle).toBe(4);
    expect(state.resources.exposure).toBe(44);
  });

  it('bloquea configuraciones inviables por restricción operativa y falta de recursos', () => {
    const state = createInitialState();

    // 1. Combinación prohibida: Refugio + Electrólisis intensiva + Cultivo activo
    const forbidden: CycleDecision = {
      eclss: 'intensive',
      greenhouse: 'active',
      protection: 'shelter',
    };
    const forbiddenResult = validateDecision(state, forbidden);
    expect(forbiddenResult.valid).toBe(false);
    expect(forbiddenResult.blockedByRestriction).toBe(true);
    expect(() => advanceCycle(state, forbidden)).toThrow();

    // 2. Energía insuficiente (ej. energía muy baja en estado artificial)
    const lowEnergyState = {
      ...state,
      resources: { ...state.resources, energy: 5 }, // +19 solar -7 crew = 17 disponibles; intensivo+activo = 19+13=32
    };
    const expensive: CycleDecision = {
      eclss: 'intensive',
      greenhouse: 'active',
      protection: 'normal',
    };
    const energyResult = validateDecision(lowEnergyState, expensive);
    expect(energyResult.valid).toBe(false);
    expect(energyResult.insufficientResources).toContain('energy');

    // Previsualización sigue siendo segura y reporta la invalidez
    const preview = previewCycle(lowEnergyState, expensive);
    expect(preview.validation.valid).toBe(false);
  });

  it('conserva el progreso del cultivo durante la latencia y cosecha en el segundo ciclo activo', () => {
    let state = createInitialState();
    state = advanceCycle(state, NOMINAL_STANDBY_NORMAL); // C1
    state = advanceCycle(state, NOMINAL_STANDBY_NORMAL); // C2
    // C3: primer ciclo activo -> progreso 1/2
    state = advanceCycle(state, { eclss: 'nominal', greenhouse: 'active', protection: 'normal' });
    expect(state.cropProgress).toBe(1);
    expect(state.harvestsCompleted).toBe(0);

    // C4: pasa a latencia con refugio -> progreso se conserva en 1/2
    state = advanceCycle(state, { eclss: 'nominal', greenhouse: 'standby', protection: 'shelter' });
    expect(state.cropProgress).toBe(1);
    expect(state.harvestsCompleted).toBe(0);

    // C5: segundo ciclo activo -> cosecha +32 alimentos y reinicia progreso a 0
    const foodBeforeC5 = state.resources.food;
    state = advanceCycle(state, { eclss: 'nominal', greenhouse: 'active', protection: 'normal' });
    expect(state.cropProgress).toBe(0);
    expect(state.harvestsCompleted).toBe(1);
    expect(state.resources.food).toBe(foodBeforeC5 - 8 + 32);
  });

  it('restaura una misión en progreso tras recargar la página mediante persistencia local', () => {
    const memory = new Map<string, string>();
    const mockStorage: StorageAdapter = {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => {
        memory.set(k, v);
      },
      removeItem: (k) => {
        memory.delete(k);
      },
    };

    let state = createInitialState(2);
    state = advanceCycle(state, NOMINAL_STANDBY_NORMAL);
    state = advanceCycle(state, { eclss: 'intensive', greenhouse: 'standby', protection: 'normal' });

    saveSession(
      {
        phase: 'mission',
        simulation: state,
        previousAttempts: [
          {
            attemptNumber: 1,
            status: 'failed',
            cyclesCompleted: 4,
            finalResources: { oxygen: 20, water: 30, food: 12, energy: 40, exposure: 44 },
            harvestsCompleted: 0,
          },
        ],
      },
      mockStorage
    );

    const restored = loadSession(mockStorage);
    expect(restored).not.toBeNull();
    expect(restored?.phase).toBe('mission');
    expect(restored?.simulation.cycle).toBe(3);
    expect(restored?.simulation.attemptNumber).toBe(2);
    expect(restored?.simulation.resources).toEqual(state.resources);
    expect(restored?.previousAttempts).toHaveLength(1);
  });
});

it('no modifica entradas ni conserva referencias mutables a decisiones', () => {
  const state = createInitialState();
  const snapshot = structuredClone(state);
  const decision = { ...NOMINAL_STANDBY_NORMAL };
  const next = advanceCycle(state, decision);
  decision.eclss = 'intensive';
  expect(state).toEqual(snapshot);
  expect(next.history[0].decision.eclss).toBe('nominal');
});

it('bloquea demanda hídrica y limita las reservas a 100 unidades', () => {
  const state = createInitialState();
  expect(validateDecision({ ...state, resources: { ...state.resources, water: 10 } }, { eclss: 'intensive', greenhouse: 'standby', protection: 'normal' }).insufficientResources).toContain('water');
  const next = advanceCycle({ ...state, resources: { oxygen: 100, water: 100, food: 100, energy: 100, exposure: 0 } }, NOMINAL_STANDBY_NORMAL);
  expect(next.resources.energy).toBe(82);
  for (const value of Object.values(next.resources)) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  }
});

it.each([
  ['food', 4, 'food_depleted'],
  ['oxygen', 10, 'oxygen_depleted'],
] as const)('advierte supervivencia por %s sin bloquear ejecución', (resource, amount, code) => {
  const state = createInitialState();
  state.cycle = 6;
  state.resources[resource] = amount;
  const preview = previewCycle(state, NOMINAL_STANDBY_NORMAL);
  expect(preview.survivalWarning?.code).toBe(code);
  expect(preview.validation.valid).toBe(true);
  expect(advanceCycle(state, NOMINAL_STANDBY_NORMAL).failure?.code).toBe(code);
});

it('no muestra warning cuando alcanza consumo basal', () => {
  expect(previewCycle(createInitialState(), NOMINAL_STANDBY_NORMAL).survivalWarning).toBeNull();
});

it('desglosa el balance del ciclo y coincide con la proyección del motor', () => {
  const cases: Array<[SimulationState, CycleDecision]> = [
    [createInitialState(), NOMINAL_STANDBY_NORMAL],
    [createInitialState(), { eclss: 'intensive', greenhouse: 'active', protection: 'normal' }],
    [
      { ...createInitialState(), cycle: 5, cropProgress: 1, resources: { oxygen: 40, water: 60, food: 20, energy: 55, exposure: 20 } },
      { eclss: 'nominal', greenhouse: 'active', protection: 'normal' },
    ],
  ];

  for (const [state, decision] of cases) {
    const preview = previewCycle(state, decision);
    const breakdown = getCycleBreakdown(state, decision);
    for (const row of breakdown.rows) {
      expect(row.end).toBe(preview.projected[row.key]);
      expect(row.net).toBe(row.end - row.start);
    }
    expect(breakdown.willHarvest).toBe(preview.willHarvest);
  }

  const harvest = getCycleBreakdown(cases[2][0], cases[2][1]);
  expect(harvest.rows.find((row) => row.key === 'food')?.harvest).toBe(32);
  expect(harvest.willHarvest).toBe(true);
});

it('verifica con el motor el contrafactual de operar sin refugio en el ciclo 4', () => {
  const plan: CycleDecision[] = [
    { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' },
    { eclss: 'intensive', greenhouse: 'standby', protection: 'normal' },
    { eclss: 'nominal', greenhouse: 'active', protection: 'normal' },
    { eclss: 'nominal', greenhouse: 'standby', protection: 'shelter' },
    { eclss: 'nominal', greenhouse: 'active', protection: 'normal' },
    { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' },
    { eclss: 'nominal', greenhouse: 'standby', protection: 'normal' },
  ];

  let state = createInitialState();
  for (const decision of plan) state = advanceCycle(state, decision);
  expect(state.status).toBe('victory');

  const counterfactual = buildCounterfactual(state, 4, { protection: 'normal' });
  expect(counterfactual).not.toBeNull();
  expect(counterfactual?.alternative.status).toBe('failed');
  expect(counterfactual?.alternative.failureCode).toBe('radiation_exceeded');
  expect(counterfactual?.alternative.exposure).toBe(44);
  expect(counterfactual?.differs).toBe(true);
  expect(buildCounterfactual(state, 4, { protection: 'shelter' })).toBeNull();
});
