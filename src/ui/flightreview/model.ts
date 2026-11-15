import type { Command, Design, Horizon, LoggedCommand, MissionState, Projection, Sample, Scenario } from '../../engine/types';
import { capacity } from '../../game/sim';

export type ResourceKey = 'o2' | 'water' | 'food' | 'energy';
export const RESOURCE_LABELS: Record<ResourceKey, string> = { o2: 'Oxígeno', water: 'Agua', food: 'Alimentos', energy: 'Energía almacenada' };

export interface FlightComparison {
  fromT: number;
  scenario: Scenario;
  design: Design;
  sourceLog: LoggedCommand[];
  horizon: Horizon;
  plan: Command[];
  baseline: Projection;
  alternative: Projection;
}

export type ProjectMission = (mission: MissionState, plan: Command[], horizon: Horizon) => Projection;

export function compareFlightPlans(mission: MissionState, plan: Command[], horizon: Horizon, project: ProjectMission): FlightComparison {
  if (mission.phase !== 'running') throw new Error('La comparación requiere un checkpoint de misión en curso');
  return {
    fromT: mission.t, scenario: structuredClone(mission.scenario), design: structuredClone(mission.design),
    sourceLog: structuredClone(mission.log), horizon: structuredClone(horizon), plan: structuredClone(plan),
    baseline: project(structuredClone(mission), [], structuredClone(horizon)),
    alternative: project(structuredClone(mission), structuredClone(plan), structuredClone(horizon)),
  };
}

export function comparisonMatches(mission: MissionState, comparison: FlightComparison): boolean {
  return Number.isFinite(comparison.fromT) && comparison.fromT >= 0 && comparison.fromT <= mission.t
    && JSON.stringify(mission.scenario) === JSON.stringify(comparison.scenario)
    && JSON.stringify(mission.design) === JSON.stringify(comparison.design)
    && JSON.stringify(mission.log.slice(0, comparison.sourceLog.length)) === JSON.stringify(comparison.sourceLog);
}

export function resourceRows(mission: MissionState) {
  const cap = capacity(mission.game);
  const initial = mission.samples.find(sample => sample.t === 0);
  return (Object.keys(RESOURCE_LABELS) as ResourceKey[]).map(key => ({
    key, label: RESOURCE_LABELS[key], initial: initial?.[key],
    final: cap[key] > 0 ? mission.game.res[key] / cap[key] * 100 : NaN,
    sampledMinimum: mission.samples.length ? Math.min(...mission.samples.map(sample => sample[key])) : NaN,
  }));
}

export function projectionValues(projection: Projection, fromT: number) {
  const final = projection.samples.at(-1);
  const vital = projection.samples.flatMap(sample => [sample.o2, sample.water, sample.food]);
  return {
    until: projection.until, phase: projection.phase, energy: final?.energy,
    minLifeSupport: vital.length ? Math.min(...vital) : NaN,
    exposure: final?.exposure,
    harvests: projection.events.filter(event => event.kind === 'harvest' && event.t >= fromT).length,
  };
}

export function commandText(command: Command): string {
  switch (command.type) {
    case 'setGrowLights': return `Luces de cultivo → ${numberText(command.value)} %`;
    case 'setPower': {
      const system = { heating: 'Calefacción', processor: 'Procesador', robots: 'Robots', greenhouse: 'Invernadero' }[command.system];
      return `${system} → ${command.on ? 'encendido' : 'apagado'}`;
    }
    case 'setPriority': {
      const names = { lifeSupport: 'Soporte vital', heating: 'Calefacción', processor: 'Procesador', robots: 'Robots', greenhouse: 'Invernadero' };
      return `Prioridad eléctrica → ${command.order.map((c) => names[c]).join(' › ')}`;
    }
    case 'adjustClimate': return command.dir === 1 ? 'Subir temperatura' : 'Bajar temperatura';
    case 'irrigate': return 'Regar cultivo';
    case 'harvest': return 'Cosechar';
    case 'replant': return 'Replantar';
    case 'enterShelter': return 'Entrar al refugio';
    case 'leaveShelter': return 'Salir del refugio';
    case 'collectRegolith': return 'Recoger regolito';
    case 'deliverRegolith': return 'Entregar regolito';
  }
}

export function numberText(value: number | undefined, unit = ''): string {
  return value !== undefined && Number.isFinite(value)
    ? `${new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ''}`
    : 'Sin registro';
}

export function phaseText(phase: MissionState['phase']): string {
  return { running: 'En curso', victory: 'Misión completada', failed: 'Misión interrumpida' }[phase];
}

export function validSamples(samples: Sample[]): Sample[] {
  return samples.filter(sample => Number.isFinite(sample.t)).slice().sort((a, b) => a.t - b.t);
}
