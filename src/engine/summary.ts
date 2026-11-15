import { figure } from './observation';
import type { MissionState, Summary } from './types';

export function summarize(ms: MissionState): Summary {
  return {
    phase: ms.phase, failure: structuredClone(ms.failure), duration: ms.t, design: structuredClone(ms.design),
    harvests: ms.game.stats.harvests, exposure: ms.exposure, ...ms.metrics,
    tradeoffs: [
      `Luces reducidas por decisión durante ${figure(ms.metrics.secondsLightsReduced)} s; cortes de potencia ${figure(ms.metrics.secondsShortage)} s.`,
      `Refugio durante ${figure(ms.metrics.secondsSheltered)} s; exposición recibida ${figure(ms.exposure)} u.`,
      `Soporte vital mínimo ${figure(ms.metrics.minLifeSupport)} %; cosechas ${ms.game.stats.harvests}.`,
    ],
  };
}
