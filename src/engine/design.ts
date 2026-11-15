import { capacity, lifeSupportPercent } from '../game/sim';
import { newGame } from '../game/state';
import { emptyLedger } from './ledger';
import { LIMITS, MISSION_RULES, PRICES, SCENARIO_1 } from './mission1';
import { sample, syncStorm } from './observation';
import { STEP, type Design, type DesignCheck, type MissionState, type Scenario } from './types';

export function emptyDesign(): Design {
  return { solarMasts: 0, batteries: 0, greenhouse: 0, processor: 0, shield: 0, reserves: { o2: 0, water: 0, food: 0 } };
}

export function checkDesign(d: Design, scenario = SCENARIO_1): DesignCheck {
  const entries = {
    solarMasts: d?.solarMasts, batteries: d?.batteries, greenhouse: d?.greenhouse,
    processor: d?.processor, shield: d?.shield, reserveO2: d?.reserves?.o2,
    reserveWater: d?.reserves?.water, reserveFood: d?.reserves?.food,
  };
  let spent = 0;
  const reasons: string[] = [];
  for (const key of Object.keys(PRICES) as (keyof typeof PRICES)[]) {
    const n = entries[key];
    if (!Number.isInteger(n) || n < 0 || n > LIMITS[key]) reasons.push(`${key}: cantidad inválida (0–${LIMITS[key]})`);
    if (Number.isFinite(n)) spent += n * PRICES[key];
  }
  if (spent > scenario.budget) reasons.push(`Presupuesto superado: ${spent} / ${scenario.budget}`);
  return { ok: reasons.length === 0, spent, budget: scenario.budget, reasons };
}

function validateScenario(s: Scenario): void {
  const aligned = (n: number) => Number.isFinite(n) && n >= 0 && Number.isInteger(n / STEP);
  if (s.id !== 'mision-1' || !aligned(s.duration) || s.duration === 0 || !Number.isFinite(s.seed) ||
      !Number.isFinite(s.budget) || s.budget < 0 || !Number.isFinite(s.exposureLimit) || s.exposureLimit < 0 ||
      !aligned(s.depletionGrace)) throw new Error('Escenario inválido');
  for (const e of s.events) {
    if (!['darkness', 'storm'].includes(e.kind) || ![e.warnAt, e.startAt, e.endAt].every(aligned) ||
        e.warnAt > e.startAt || e.startAt >= e.endAt || e.endAt > s.duration ||
        (e.kind === 'storm' && (!Number.isFinite(e.strength) || e.strength! < 0 || e.strength! > 1))) throw new Error('Evento inválido');
  }
  for (const kind of ['darkness', 'storm']) {
    const events = s.events.filter(e => e.kind === kind).sort((a, b) => a.warnAt - b.warnAt);
    if (events.some((e, i) => i > 0 && e.warnAt < events[i - 1].endAt)) throw new Error('Eventos solapados');
  }
}

export function startMission(d: Design, scenario = SCENARIO_1): MissionState {
  validateScenario(scenario);
  const checked = checkDesign(d, scenario);
  if (!checked.ok) throw new Error(checked.reasons.join('; '));
  const game = newGame(0);
  game.levels = { ...game.levels, station: 1, antenna: 1, greenhouse: 1 + d.greenhouse, processor: d.processor, shield: d.shield };
  game.counts = { solarMast: 1 + d.solarMasts, battery: d.batteries };
  game.power.growLights = MISSION_RULES.initialGrowLights;
  const cap = capacity(game);
  for (const r of ['o2', 'water', 'food'] as const) game.res[r] = cap[r] * (MISSION_RULES.initialReserve + MISSION_RULES.reservePerPack * d.reserves[r]);
  game.res.energy = cap.energy * MISSION_RULES.initialEnergy;
  const ms: MissionState = {
    version: 2, scenario: structuredClone(scenario), design: structuredClone(d), t: 0, rng: scenario.seed,
    game, lastPower: { generation: 0, demand: 0, running: { processor: false, robots: false, heating: false, lights: 0 }, shortage: false, lifeSupportPowered: true },
    metrics: { minLifeSupport: lifeSupportPercent(game), secondsLightsReduced: 0, secondsSheltered: 0, secondsShortage: 0 },
    ledger: emptyLedger(), exposure: 0, depleted: { o2: 0, water: 0, food: 0 }, phase: 'running', failure: null,
    log: [], events: [], samples: [],
  };
  syncStorm(ms);
  ms.samples.push(sample(ms));
  return ms;
}
