import type { MissionState } from '../../engine/types';
import { capacity } from '../../game/sim';
import { numberText } from '../flightreview/model';

export type BadgeId = 'mission' | 'life' | 'energy' | 'harvest' | 'shelter';

export interface BadgeProgress {
  id: BadgeId;
  title: string;
  criterion: string;
  unlocked: boolean;
  evidence: string;
}

export function verifiedCompletion(mission: MissionState): boolean {
  const cap = capacity(mission.game);
  const final = mission.samples.at(-1);
  const finite = [mission.t, mission.scenario.duration, mission.scenario.seed, mission.scenario.exposureLimit,
    mission.scenario.depletionGrace, mission.exposure, mission.game.crewHealth, ...Object.values(mission.metrics), ...Object.values(mission.depleted)];
  if (!finite.every(Number.isFinite) || mission.scenario.duration <= 0 || mission.t !== mission.scenario.duration) return false;
  if (mission.phase !== 'victory' || mission.failure || mission.game.crewHealth <= 0 || mission.exposure < 0 || mission.exposure > mission.scenario.exposureLimit) return false;
  if (!mission.events.some(event => event.kind === 'victory' && event.t === mission.t) || mission.events.some(event => event.kind === 'failure')) return false;
  if (!final || final.t !== mission.t || !mission.samples.some(sample => sample.t === 0)) return false;
  if (!Number.isInteger(mission.game.stats.harvests) || mission.game.stats.harvests < 0) return false;
  if (mission.metrics.minLifeSupport < 0 || mission.metrics.minLifeSupport > 100) return false;
  if ([mission.metrics.secondsLightsReduced, mission.metrics.secondsSheltered, mission.metrics.secondsShortage].some(value => value < 0 || value > mission.t)) return false;
  if (Object.values(mission.depleted).some(value => value < 0 || value > mission.scenario.depletionGrace)) return false;
  if (mission.log.some((entry, i) => !Number.isFinite(entry.t) || entry.t < 0 || entry.t > mission.t || (i > 0 && entry.t < mission.log[i - 1].t))) return false;
  if (mission.events.some(event => !Number.isFinite(event.t) || event.t < 0 || event.t > mission.t)) return false;
  for (let i = 0; i < mission.samples.length; i++) {
    const sample = mission.samples[i];
    if (![sample.t, sample.o2, sample.water, sample.food, sample.energy, sample.exposure, sample.crewHealth].every(Number.isFinite)) return false;
    if (sample.t < 0 || sample.t > mission.t || (i > 0 && sample.t < mission.samples[i - 1].t)) return false;
    if (mission.metrics.minLifeSupport > Math.min(sample.o2, sample.water, sample.food) + 1e-7) return false;
  }
  if (Math.abs(final.exposure - mission.exposure) > 1e-7 || Math.abs(final.crewHealth - mission.game.crewHealth) > 1e-7) return false;
  return (['o2', 'water', 'food', 'energy'] as const).every(key => {
    const value = mission.game.res[key];
    return Number.isFinite(value) && value >= 0 && value <= cap[key] && Math.abs(final[key] - value / cap[key] * 100) < 1e-7;
  });
}

function shelteredDuringStorm(mission: MissionState): boolean {
  const storms = mission.scenario.events.filter(event => event.kind === 'storm' && event.endAt > event.startAt && event.endAt <= mission.t);
  return storms.some(storm => {
    if (!mission.events.some(event => event.kind === 'storm_start' && event.t === storm.startAt)
      || !mission.events.some(event => event.kind === 'storm_end' && event.t === storm.endAt)) return false;
    let entered: number | null = null;
    let covered = 0;
    for (const entry of mission.log) {
      if (!entry.ok) continue;
      if (entry.cmd.type === 'enterShelter' && entered === null && mission.events.some(event => event.kind === 'shelter_enter' && event.t === entry.t)) entered = entry.t;
      if (entry.cmd.type === 'leaveShelter' && entered !== null) {
        covered += Math.max(0, Math.min(entry.t, storm.endAt) - Math.max(entered, storm.startAt));
        entered = null;
      }
    }
    if (entered !== null) covered += Math.max(0, storm.endAt - Math.max(entered, storm.startAt));
    return covered >= storm.endAt - storm.startAt && mission.metrics.secondsSheltered >= covered;
  });
}

export function evaluateBadges(mission: MissionState): BadgeProgress[] {
  const verified = verifiedCompletion(mission);
  const harvests = mission.events.filter(event => event.kind === 'harvest');
  const harvestCommands = mission.log.filter(entry => entry.ok && entry.cmd.type === 'harvest');
  const matchedHarvests = harvests.length === mission.game.stats.harvests && harvests.length === harvestCommands.length
    && harvests.every((event, i) => event.t === harvestCommands[i].t);
  const evidence = `${mission.scenario.id} · semilla ${mission.scenario.seed} · ${numberText(mission.t, 's')} simulados`;
  const definitions: [BadgeId, string, string, boolean, string][] = [
    ['mission', 'Primera oscuridad', 'Completar el escenario con victoria y registros finales coherentes.', verified, evidence],
    ['life', 'Soporte vital', 'Victoria con mínimo vital global ≥20 % durante todo el vuelo.', verified && mission.metrics.minLifeSupport >= 20, `${evidence} · mínimo ${numberText(mission.metrics.minLifeSupport, '%')}`],
    ['energy', 'Continuidad energética', 'Victoria sin intervalos de potencia insuficiente ni eventos de corte.', verified && mission.metrics.secondsShortage === 0 && !mission.events.some(event => event.kind === 'power_shortage'), `${evidence} · cortes ${numberText(mission.metrics.secondsShortage, 's')}`],
    ['harvest', 'Cultivo lunar', 'Victoria con al menos una cosecha coincidente en comando aceptado, evento y contador.', verified && matchedHarvests && harvests.length > 0, `${evidence} · ${harvests.length} cosechas contrastadas`],
    ['shelter', 'Refugio a tiempo', 'Victoria con una tormenta completa cubierta por entradas/salidas aceptadas del refugio.', verified && shelteredDuringStorm(mission), `${evidence} · refugio ${numberText(mission.metrics.secondsSheltered, 's')}`],
  ];
  return definitions.map(([id, title, criterion, unlocked, detail]) => ({ id, title, criterion, unlocked, evidence: unlocked ? detail : 'Criterio pendiente de evidencia en un vuelo completado.' }));
}

export function collectBadges(missions: readonly MissionState[]): BadgeProgress[] {
  const definitions: BadgeProgress[] = [
    { id: 'mission', title: 'Primera oscuridad', criterion: 'Completar el escenario con victoria y registros finales coherentes.', unlocked: false, evidence: '' },
    { id: 'life', title: 'Soporte vital', criterion: 'Victoria con mínimo vital global ≥20 % durante todo el vuelo.', unlocked: false, evidence: '' },
    { id: 'energy', title: 'Continuidad energética', criterion: 'Victoria sin intervalos de potencia insuficiente ni eventos de corte.', unlocked: false, evidence: '' },
    { id: 'harvest', title: 'Cultivo lunar', criterion: 'Victoria con al menos una cosecha coincidente en comando aceptado, evento y contador.', unlocked: false, evidence: '' },
    { id: 'shelter', title: 'Refugio a tiempo', criterion: 'Victoria con una tormenta completa cubierta por entradas/salidas aceptadas del refugio.', unlocked: false, evidence: '' },
  ];
  for (const mission of missions) for (const progress of evaluateBadges(mission)) {
    const index = definitions.findIndex(badge => badge.id === progress.id);
    if (progress.unlocked) definitions[index] = progress;
  }
  return definitions;
}
