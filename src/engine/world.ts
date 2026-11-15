import { CREW, ENERGY } from '../game/config';
import { solarMastsOutput } from '../game/damage';
import { capacity, clamp, lifeSupportPercent, step, stepGreenhouse, type PowerReport } from '../game/sim';
import type { GameState } from '../game/state';
import { protection } from '../game/storm';
import { MISSION_RULES } from './mission1';
import { STEP, SAMPLE_EVERY, type EventKind, type Failure, type MissionState, type Sample, type Scenario, type ScenarioEvent } from './types';

// One fixed step of the mission world. Daylight and the storm come from the scenario, not
// from the free-mode day cycle; nothing random, no rescue, no impacts, no render callbacks.

const EPS = 1e-9;

export function isDarkAt(scenario: Scenario, t: number): boolean {
  return scenario.events.some((e) => e.kind === 'darkness' && t >= e.startAt - EPS && t < e.endAt - EPS);
}

function stormAt(scenario: Scenario, t: number): ScenarioEvent | undefined {
  return scenario.events.find((e) => e.kind === 'storm' && t >= e.warnAt - EPS && t < e.endAt - EPS);
}

/**
 * Power for the mission: the free-mode rules (life support first, then heating, processor,
 * lights) with one adaptation: each greenhouse level draws the grow lights again.
 */
function missionPower(s: GameState, dt: number, isDay: boolean): PowerReport {
  const generation = isDay ? ENERGY.landerSolar + solarMastsOutput(s) * ENERGY.solarPerMast : 0;
  const farm = Math.max(1, s.levels.greenhouse) * MISSION_RULES.lightsDrawPerLevel;
  const want = {
    lights: s.levels.greenhouse > 0 ? (s.power.growLights / 100) * ENERGY.growLightsMaxDraw * farm : 0,
    processor: s.levels.processor > 0 && s.power.processor && !s.sheltered ? ENERGY.processorDraw : 0,
    heating: s.power.heating && !isDay ? ENERGY.heatingDraw : 0,
  };
  let budget = dt > 0 ? s.res.energy / dt + generation - ENERGY.lifeSupportDraw : generation - ENERGY.lifeSupportDraw + (s.res.energy > 0 ? Infinity : 0);
  const lifeSupportPowered = budget >= 0;
  const on = { lights: 0, robots: false, processor: false, heating: false };
  if (want.heating > 0 && budget >= want.heating) { on.heating = true; budget -= want.heating; }
  if (want.processor > 0 && budget >= want.processor) { on.processor = true; budget -= want.processor; }
  if (want.lights > 0 && budget > 0) on.lights = s.power.growLights * Math.min(1, budget / want.lights);
  const lightsDraw = want.lights > 0 ? want.lights * (on.lights / Math.max(1, s.power.growLights)) : 0;
  const demand = ENERGY.lifeSupportDraw + (on.heating ? want.heating : 0) + (on.processor ? want.processor : 0) + lightsDraw;
  const shortage = !lifeSupportPowered || (want.heating > 0 && !on.heating) || (want.processor > 0 && !on.processor) || on.lights < s.power.growLights - 0.5;
  if (dt > 0) s.res.energy = clamp(s.res.energy + (generation - demand) * dt, 0, capacity(s).energy);
  return { generation, demand, running: { ...on }, shortage, lifeSupportPowered };
}

/** The power balance right now, without changing anything (for the start and the bar). */
export function previewPower(g: GameState, scenario: Scenario, t: number): PowerReport {
  return missionPower(structuredClone(g), 0, !isDarkAt(scenario, t));
}

export function darknessAt(ms: MissionState): { isDark: boolean; secondsLeft: number } {
  const dark = ms.scenario.events.find((e) => e.kind === 'darkness' && ms.t < e.endAt - EPS);
  if (!dark) return { isDark: false, secondsLeft: 0 };
  const isDark = ms.t >= dark.startAt - EPS;
  return { isDark, secondsLeft: (isDark ? dark.endAt : dark.startAt) - ms.t };
}

/** The scenario event in progress or the next one, or null when none is left. */
export function nextEvent(ms: MissionState): ScenarioEvent | null {
  return ms.scenario.events.filter((e) => e.endAt > ms.t + EPS).sort((a, b) => a.warnAt - b.warnAt)[0] ?? null;
}

const pct = (v: number, cap: number) => (cap > 0 ? (v / cap) * 100 : 0);

export function makeSample(ms: MissionState): Sample {
  const g = ms.game;
  const cap = capacity(g);
  return {
    t: ms.t,
    o2: pct(g.res.o2, cap.o2),
    water: pct(g.res.water, cap.water),
    food: pct(g.res.food, cap.food),
    energy: pct(g.res.energy, cap.energy),
    exposure: ms.exposure,
    crewHealth: g.crewHealth,
    lights: ms.lastPower.running.lights,
    plantGrowth: g.plant.growth,
    sheltered: g.sheltered,
    isDark: isDarkAt(ms.scenario, ms.t),
  };
}

const EVENT_TEXT: Record<string, (e: ScenarioEvent) => string> = {
  darkness_warning: (e) => `Aviso: en ${e.startAt - e.warnAt} s se va el Sol durante ${e.endAt - e.startAt} s.`,
  darkness_start: () => 'Se fue el Sol: los paneles no dan energía.',
  darkness_end: () => 'Volvió el Sol: los paneles cargan la batería.',
  storm_warning: (e) => `Aviso: tormenta solar en ${e.startAt - e.warnAt} s${e.inspiredBy ? `, como la fulguración ${e.inspiredBy.class} del ${e.inspiredBy.peak.slice(0, 10)} (NASA DONKI)` : ''}.`,
  storm_start: () => 'Llegó la tormenta: fuera del refugio la radiación sube rápido.',
  storm_end: () => 'Terminó la tormenta solar.',
};

export function emit(ms: MissionState, kind: EventKind, text: string): void {
  ms.events.push({ t: ms.t, kind, text });
}

/** Keep the free-mode storm fields in sync so the 3D scene and HUD can show the scenario storm. */
function showStorm(ms: MissionState): void {
  const e = stormAt(ms.scenario, ms.t);
  const st = ms.game.storm;
  if (!e) {
    Object.assign(st, { phase: 'none', timeLeft: 0, strength: 0, flare: null });
    return;
  }
  const active = ms.t >= e.startAt - EPS;
  Object.assign(st, {
    phase: active ? 'active' : 'warning',
    timeLeft: (active ? e.endAt : e.startAt) - ms.t,
    strength: e.strength ?? 1,
    flare: e.inspiredBy ? { ...e.inspiredBy } : null,
  });
}

function fail(ms: MissionState, code: Failure['code'], title: string, explanation: string): void {
  ms.phase = 'failed';
  ms.failure = { code, t: ms.t, title, explanation };
  emit(ms, 'failure', title);
}

/** Advance exactly STEP seconds. Does nothing once the mission is over. */
export function worldStep(ms: MissionState): void {
  if (ms.phase !== 'running') return;
  const g = ms.game;
  const sc = ms.scenario;
  const t0 = ms.t;
  const dark = isDarkAt(sc, t0);
  showStorm(ms);

  // Power, crew, processor, greenhouse.
  const wasShort = ms.lastPower.shortage;
  const wasPowered = ms.lastPower.lifeSupportPowered;
  const report = missionPower(g, STEP, !dark);
  step(g, STEP, report.running);
  const cap = capacity(g);
  g.res.o2 = clamp(g.res.o2 - CREW.o2PerSecond * (MISSION_RULES.crewRate.o2 - 1) * STEP, 0, cap.o2);
  g.res.water = clamp(g.res.water - CREW.waterPerSecond * (MISSION_RULES.crewRate.water - 1) * STEP, 0, cap.water);
  g.res.food = clamp(g.res.food - CREW.foodPerSecond * (MISSION_RULES.crewRate.food - 1) * STEP, 0, cap.food);
  const growth = g.plant.growth;
  const wasDead = g.plant.dead;
  stepGreenhouse(g, STEP, !dark, report.running);
  // In the shelter nobody tends the farm: the plant still drifts, but it does not grow.
  if (g.sheltered) g.plant.growth = growth;
  if (!report.lifeSupportPowered) g.crewHealth = clamp(g.crewHealth - MISSION_RULES.unpoweredHealthLoss * STEP, 0, 100);

  // Storm exposure: outside rate times what the current place does not stop.
  const storm = sc.events.find((e) => e.kind === 'storm' && t0 >= e.startAt - EPS && t0 < e.endAt - EPS);
  if (storm) ms.exposure += MISSION_RULES.stormRate * (storm.strength ?? 1) * (1 - protection(g)) * STEP;

  // Metrics, per step.
  if (report.running.lights < g.power.growLights - 0.5) ms.metrics.secondsLightsReduced += STEP;
  if (g.sheltered) ms.metrics.secondsSheltered += STEP;
  if (report.shortage) ms.metrics.secondsShortage += STEP;
  for (const k of ['o2', 'water', 'food'] as const) ms.depleted[k] = g.res[k] <= 0 ? ms.depleted[k] + STEP : 0;
  ms.lastPower = report;
  ms.t = Math.round((t0 + STEP) / STEP) * STEP;
  ms.metrics.minLifeSupport = Math.min(ms.metrics.minLifeSupport, lifeSupportPercent(g));

  // Events, once each, when the step crosses their boundary.
  for (const e of sc.events) {
    for (const [at, suffix] of [[e.warnAt, 'warning'], [e.startAt, 'start'], [e.endAt, 'end']] as const) {
      if (t0 < at - EPS && ms.t >= at - EPS) emit(ms, `${e.kind}_${suffix}` as EventKind, EVENT_TEXT[`${e.kind}_${suffix}`](e));
    }
  }
  if (report.shortage && !wasShort) emit(ms, 'power_shortage', 'No alcanzó la energía: se apagaron cosas.');
  if (!report.shortage && wasShort) emit(ms, 'power_restored', 'La energía alcanza otra vez.');
  if (!report.lifeSupportPowered && wasPowered) emit(ms, 'life_support_unpowered', 'El soporte vital se quedó sin energía.');
  if (g.plant.dead && !wasDead) emit(ms, 'plant_dead', 'La planta murió.');
  showStorm(ms);

  // Failure first; victory only at the end with nothing failed.
  const names = { o2: 'aire', water: 'agua', food: 'comida' } as const;
  const empty = (['o2', 'water', 'food'] as const).find((k) => ms.depleted[k] > sc.depletionGrace);
  if (g.crewHealth <= 0) {
    const why = ms.metrics.secondsShortage > 0 && !report.lifeSupportPowered
      ? 'el soporte vital se quedó sin energía'
      : 'se acabó el aire, el agua o la comida';
    fail(ms, 'crew_lost', 'La tripulación no aguantó', `La tripulación no aguantó en el segundo ${Math.round(ms.t)}: ${why}.`);
  } else if (ms.exposure > sc.exposureLimit) {
    fail(ms, 'exposure_exceeded', 'Demasiada radiación', `La radiación llegó a ${ms.exposure.toFixed(1)} de ${sc.exposureLimit} en el segundo ${Math.round(ms.t)}${g.sheltered ? '' : ', fuera del refugio durante la tormenta'}.`);
  } else if (empty) {
    fail(ms, `${empty}_depleted`, `Se acabó el ${names[empty]}`, `El ${names[empty]} se acabó y no volvió en ${sc.depletionGrace} s (segundo ${Math.round(ms.t)}).`);
  } else if (ms.t >= sc.duration - EPS) {
    ms.phase = 'victory';
    emit(ms, 'victory', `¡Misión cumplida! Llegaste al segundo ${sc.duration} con ${ms.exposure.toFixed(1)} de radiación.`);
  }

  // Samples every SAMPLE_EVERY seconds, and always the last one.
  if (Math.floor(ms.t / SAMPLE_EVERY + EPS) > Math.floor(t0 / SAMPLE_EVERY + EPS) || ms.phase !== 'running') {
    if (ms.samples[ms.samples.length - 1]?.t !== ms.t) ms.samples.push(makeSample(ms));
  }
}
