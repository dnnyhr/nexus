import { CREW, ENERGY, PROCESSOR } from '../game/config';
import { processorFactor } from '../game/damage';
import { capacity, clamp, resolvePower, step, stepGreenhouse } from '../game/sim';
import { protection } from '../game/storm';
import { RESOURCES } from './ledger';
import { MISSION_RULES } from './mission1';
import { darknessAt, figure, sample, syncStorm, updateMinimum } from './observation';
import { SAMPLE_EVERY, STEP, type FailureCode, type MissionState } from './types';

function scenarioEvents(ms: MissionState, previous: number): void {
  for (const event of ms.scenario.events) {
    for (const [at, suffix] of [[event.warnAt, 'warning'], [event.startAt, 'start'], [event.endAt, 'end']] as const) {
      if (previous >= at || ms.t < at) continue;
      const text = event.kind === 'darkness'
        ? suffix === 'end'
          ? `Fin de la oscuridad: batería ${figure(sample(ms).energy)} %, luces reducidas ${figure(ms.metrics.secondsLightsReduced)} s`
          : suffix === 'warning' ? `Oscuridad prevista en ${figure(event.startAt - ms.t)} s` : 'Comienza la oscuridad'
        : suffix === 'end'
          ? `Fin de tormenta: exposición ${figure(ms.exposure)} u; refugio ${figure(ms.metrics.secondsSheltered)} s`
          : suffix === 'warning' ? `Tormenta prevista en ${figure(event.startAt - ms.t)} s` : 'Comienza la tormenta';
      ms.events.push({ t: at, kind: `${event.kind}_${suffix}`, text });
    }
  }
}

function closeMission(ms: MissionState): void {
  let code: FailureCode | null = null;
  let explanation = '';
  for (const r of ['o2', 'water', 'food'] as const) {
    if (ms.depleted[r] > ms.scenario.depletionGrace) {
      code = `${r}_depleted`;
      explanation = `${r} agotado durante ${figure(ms.depleted[r])} s; margen ${figure(ms.scenario.depletionGrace)} s`;
      break;
    }
  }
  if (ms.exposure > ms.scenario.exposureLimit) {
    code = 'exposure_exceeded';
    explanation = `Exposición ${figure(ms.exposure)} u supera límite ${figure(ms.scenario.exposureLimit)} u`;
  }
  if (ms.game.crewHealth <= 0) {
    code = 'crew_lost';
    explanation = `Salud ${figure(ms.game.crewHealth)} %; cortes de energía ${figure(ms.metrics.secondsShortage)} s`;
  }
  if (code) {
    ms.phase = 'failed';
    ms.failure = { code, t: ms.t, title: 'Misión fallida', explanation };
    ms.events.push({ t: ms.t, kind: 'failure', text: explanation });
  } else if (ms.t >= ms.scenario.duration) {
    ms.phase = 'victory';
    ms.events.push({ t: ms.t, kind: 'victory', text: `Misión completada en ${figure(ms.t)} s; exposición ${figure(ms.exposure)} u` });
  }
}

export function worldStep(ms: MissionState): void {
  if (ms.phase !== 'running') return;
  const s = ms.game;
  const previous = ms.t;
  const before = { ...s.res };
  const ledgerBefore = structuredClone(ms.ledger);
  const wasDead = s.plant.dead;
  const wasShortage = ms.lastPower.shortage;
  const wasPowered = ms.lastPower.lifeSupportPowered;
  const isDay = !darknessAt(ms).isDark;
  syncStorm(ms);
  const scale = s.levels.greenhouse * MISSION_RULES.agriculturalDrawPerLevel;
  const powered = { ...s, power: { ...s.power, growLights: s.sheltered ? 0 : s.power.growLights * scale } };
  const report = resolvePower(powered, STEP, isDay);
  report.running.lights /= Math.max(1, scale);
  ms.lastPower = report;
  ms.ledger.energy.solar += report.generation * STEP;
  const supportCause = s.sheltered ? 'shelter' : 'crew';
  ms.ledger.energy[supportCause] -= Math.min(ENERGY.lifeSupportDraw * STEP, before.energy + report.generation * STEP);
  if (report.running.heating) ms.ledger.energy.heating -= ENERGY.heatingDraw * STEP;
  if (report.running.processor) ms.ledger.energy.processor -= ENERGY.processorDraw * STEP;
  ms.ledger.energy.lights -= report.running.lights / 100 * ENERGY.growLightsMaxDraw * scale * STEP;
  for (const r of ['o2', 'water', 'food'] as const) ms.ledger[r].crew -= CREW[`${r}PerSecond`] * STEP;
  if (s.crewHealth > 0 && report.running.processor && s.levels.processor && !s.sheltered) {
    const used = Math.min(s.res.regolith, PROCESSOR.regolithPerSecond * (1 + 0.5 * (s.levels.processor - 1)) * processorFactor(s) * STEP);
    ms.ledger.o2.processor += used * PROCESSOR.o2PerRegolith;
  }
  step(s, STEP, report.running);
  const growth = s.plant.growth;
  stepGreenhouse(s, STEP, isDay, report.running);
  if (s.sheltered) s.plant.growth = growth;
  if (!report.lifeSupportPowered) s.crewHealth = clamp(s.crewHealth - MISSION_RULES.unpoweredHealthLoss * STEP, 0, 100);
  const storm = ms.scenario.events.find(e => e.kind === 'storm' && e.startAt <= previous && previous < e.endAt);
  if (storm) ms.exposure += MISSION_RULES.outsideExposurePerSecond * (storm.strength ?? 0) * (1 - protection(s)) * STEP;
  for (const r of RESOURCES) {
    const accounted = Object.values(ms.ledger[r]).reduce((sum, v) => sum + v, 0) - Object.values(ledgerBefore[r]).reduce((sum, v) => sum + v, 0);
    ms.ledger[r].storage += s.res[r] - before[r] - accounted;
  }
  ms.t = previous + STEP;
  s.time = ms.t;
  for (const r of ['o2', 'water', 'food'] as const) ms.depleted[r] = s.res[r] <= 0 ? ms.depleted[r] + STEP : 0;
  updateMinimum(ms);
  if (!s.sheltered && s.power.growLights < MISSION_RULES.reducedLightsBelow) ms.metrics.secondsLightsReduced += STEP;
  if (s.sheltered) ms.metrics.secondsSheltered += STEP;
  if (report.shortage) ms.metrics.secondsShortage += STEP;
  if (!wasDead && s.plant.dead) ms.events.push({ t: ms.t, kind: 'plant_dead', text: `Cultivo muerto; estrés ${figure(s.plant.stress)} %` });
  if (!wasShortage && report.shortage) ms.events.push({ t: ms.t, kind: 'power_shortage', text: `Potencia insuficiente: batería ${figure(s.res.energy / capacity(s).energy * 100)} %, luces efectivas ${figure(report.running.lights)} %; cortes acumulados ${figure(ms.metrics.secondsShortage)} s` });
  if (wasShortage && !report.shortage) ms.events.push({ t: ms.t, kind: 'power_restored', text: 'Potencia restablecida' });
  if (wasPowered && !report.lifeSupportPowered) ms.events.push({ t: ms.t, kind: 'life_support_unpowered', text: 'Soporte vital sin energía' });
  scenarioEvents(ms, previous);
  syncStorm(ms);
  closeMission(ms);
  if (ms.t % SAMPLE_EVERY === 0 || ms.phase !== 'running') ms.samples.push(sample(ms));
}
