import { capacity, lifeSupportPercent } from '../game/sim';
import { newGame } from '../game/state';
import { LIMITS, MISSION_RULES, PRICES, SCENARIO_1 } from './mission1';
import type { Design, DesignCheck, DesignItem, MissionState, Scenario } from './types';
import { makeSample, previewPower } from './world';

export function emptyDesign(): Design {
  return { solarMasts: 0, batteries: 0, greenhouse: 0, processor: 0, shield: 0, reserves: { o2: 0, water: 0, food: 0 } };
}

export function designValue(d: Design, k: DesignItem): unknown {
  switch (k) {
    case 'reserveO2': return d?.reserves?.o2;
    case 'reserveWater': return d?.reserves?.water;
    case 'reserveFood': return d?.reserves?.food;
    default: return d?.[k];
  }
}

const NAMES: Record<DesignItem, string> = {
  solarMasts: 'mástiles solares', batteries: 'baterías', greenhouse: 'niveles de invernadero', processor: 'procesador',
  shield: 'berma', reserveO2: 'reservas de oxígeno', reserveWater: 'reservas de agua', reserveFood: 'reservas de comida',
};

/** Valid means: whole numbers within each limit and a total within the budget. */
export function checkDesign(d: Design, scenario: Scenario = SCENARIO_1): DesignCheck {
  const reasons: string[] = [];
  let spent = 0;
  for (const k of Object.keys(PRICES) as DesignItem[]) {
    const v = designValue(d, k);
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) {
      reasons.push(`Cantidad no válida de ${NAMES[k]}.`);
      continue;
    }
    if (v < 0 || v > LIMITS[k]) reasons.push(`${NAMES[k][0].toUpperCase()}${NAMES[k].slice(1)}: entre 0 y ${LIMITS[k]}.`);
    spent += Math.max(0, v) * PRICES[k];
  }
  if (spent > scenario.budget) reasons.push(`El diseño cuesta ${spent} créditos y el presupuesto es ${scenario.budget}.`);
  return { ok: reasons.length === 0, spent, budget: scenario.budget, reasons };
}

/** The base described by the design, ready to run. Throws if the design is not valid. */
export function startMission(d: Design, scenario: Scenario = SCENARIO_1): MissionState {
  const check = checkDesign(d, scenario);
  if (!check.ok) throw new Error(check.reasons.join(' '));
  const design: Design = structuredClone(d);
  const g = newGame(0);
  // Included: habitat 1, antenna 1, one solar mast, greenhouse 1. Bought: the rest.
  g.levels = { ...g.levels, antenna: 1, station: 1, greenhouse: 1 + design.greenhouse, processor: design.processor, shield: design.shield };
  g.counts = { solarMast: 1 + design.solarMasts, battery: design.batteries };
  g.power = { heating: true, processor: true, robots: false, growLights: MISSION_RULES.initialLights };
  g.plant = { ...g.plant, light: MISSION_RULES.initialLights };
  const cap = capacity(g);
  const fill = (packs: number) => Math.min(1, MISSION_RULES.initialReserve + MISSION_RULES.reservePerPack * packs);
  g.res = {
    o2: cap.o2 * fill(design.reserves.o2),
    water: cap.water * fill(design.reserves.water),
    food: cap.food * fill(design.reserves.food),
    energy: cap.energy * MISSION_RULES.initialEnergy,
    regolith: design.processor ? MISSION_RULES.initialRegolith : 0,
    materials: MISSION_RULES.initialMaterials,
  };
  // The habitat is the shelter; the astronaut starts next to it.
  g.player = { x: -6, z: 6 };
  const ms: MissionState = {
    version: 2,
    scenario: structuredClone(scenario),
    design,
    t: 0,
    rng: scenario.seed >>> 0,
    game: g,
    lastPower: previewPower(g, scenario, 0),
    metrics: { minLifeSupport: lifeSupportPercent(g), secondsLightsReduced: 0, secondsSheltered: 0, secondsShortage: 0 },
    exposure: 0,
    depleted: { o2: 0, water: 0, food: 0 },
    phase: 'running',
    failure: null,
    log: [],
    events: [],
    samples: [],
  };
  ms.samples.push(makeSample(ms));
  return ms;
}
