import { CREW, ENERGY, PROCESSOR } from '../game/config';
import { processorFactor } from '../game/damage';
import { capacity, clamp, resolvePower, step, stepGreenhouse, type PowerOptions } from '../game/sim';
import type { GameState } from '../game/state';
import { protection } from '../game/storm';
import { RESOURCES } from './ledger';
import { MISSION_RULES } from './mission1';
import { darknessAt, figure, sample, scenarioEvents, syncStorm, updateMinimum } from './observation';
import { SAMPLE_EVERY, STEP, type FailureCode, type MissionState } from './types';

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

/**
 * Mission rules on top of the shared power resolver: the batteries deliver limited power, each
 * greenhouse level lights more area, and farming stops in the shelter.
 */
export function missionPowerOptions(s: GameState): Required<PowerOptions> {
  return {
    dischargeLimit: MISSION_RULES.stationDischarge + MISSION_RULES.dischargePerBattery * s.counts.battery,
    lightsDrawScale: s.levels.greenhouse * MISSION_RULES.agriculturalDrawPerLevel,
    lightsSuspended: s.sheltered,
  };
}

export function worldStep(ms: MissionState): void {
  if (ms.phase !== 'running') return;
  const s = ms.game;
  const previous = ms.t;
  const before = { ...s.res };
  const totalsBefore = RESOURCES.map(r => Object.values(ms.ledger[r]).reduce((sum, v) => sum + v, 0));
  const wasDead = s.plant.dead;
  const wasShortage = ms.lastPower.shortage;
  const wasPowered = ms.lastPower.lifeSupportPowered;
  const isDay = !darknessAt(ms).isDark;
  syncStorm(ms);
  const options = missionPowerOptions(s);
  const scale = options.lightsDrawScale;
  const report = resolvePower(s, STEP, isDay, options);
  const shed = report.shed ?? [];
  report.shortage = shed.length > 0;
  ms.lastPower = report;
  ms.ledger.energy.solar += report.generation * STEP;
  const supportCause = s.sheltered ? 'shelter' : 'crew';
  ms.ledger.energy[supportCause] -= Math.min(ENERGY.lifeSupportDraw * STEP, Math.max(0, (report.available ?? 0) * STEP));
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
  for (const [index, r] of RESOURCES.entries()) {
    const accounted = Object.values(ms.ledger[r]).reduce((sum, v) => sum + v, 0) - totalsBefore[index];
    ms.ledger[r].storage += s.res[r] - before[r] - accounted;
  }
  ms.t = previous + STEP;
  s.time = ms.t;
  for (const r of ['o2', 'water', 'food'] as const) ms.depleted[r] = s.res[r] <= 0 ? ms.depleted[r] + STEP : 0;
  updateMinimum(ms);
  if (!s.sheltered && s.power.growLights < MISSION_RULES.reducedLightsBelow) ms.metrics.secondsLightsReduced += STEP;
  if (s.sheltered) ms.metrics.secondsSheltered += STEP;
  if (report.shortage) ms.metrics.secondsShortage += STEP;
  if (!report.lifeSupportPowered) ms.metrics.secondsLifeSupportUnpowered += STEP;
  if (shed.includes('heating')) ms.metrics.secondsHeatingShed += STEP;
  if (shed.includes('greenhouse')) ms.metrics.secondsLightsShed += STEP;
  ms.metrics.minCrewHealth = Math.min(ms.metrics.minCrewHealth, s.crewHealth);
  if (!wasDead && s.plant.dead) ms.events.push({ t: ms.t, kind: 'plant_dead', text: `Cultivo muerto; estrés ${figure(s.plant.stress)} %` });
  if (!wasShortage && report.shortage) ms.events.push({ t: ms.t, kind: 'power_shortage', text: `Potencia insuficiente: batería ${figure(s.res.energy / capacity(s).energy * 100)} %, luces efectivas ${figure(report.running.lights)} %; cortes acumulados ${figure(ms.metrics.secondsShortage)} s` });
  if (wasShortage && !report.shortage) ms.events.push({ t: ms.t, kind: 'power_restored', text: 'Potencia restablecida' });
  if (wasPowered && !report.lifeSupportPowered) ms.events.push({ t: ms.t, kind: 'life_support_unpowered', text: 'Soporte vital sin energía' });
  scenarioEvents(ms, previous);
  syncStorm(ms);
  closeMission(ms);
  if (ms.t % SAMPLE_EVERY === 0 || ms.phase !== 'running') ms.samples.push(sample(ms));
}
