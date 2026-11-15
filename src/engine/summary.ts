import { checkDesign } from './design';
import type { MissionState, Summary } from './types';

const round = (v: number) => Math.round(v);

/** The report: measured numbers and what they cost, never a cause that was not computed. */
export function summarize(ms: MissionState): Summary {
  const m = ms.metrics;
  const harvests = ms.events.filter((e) => e.kind === 'harvest').length;
  const minEnergy = Math.min(...ms.samples.map((s) => s.energy));
  const spent = checkDesign(ms.design, ms.scenario).spent;
  const tradeoffs: string[] = [];
  tradeoffs.push(`Gastaste ${spent} de ${ms.scenario.budget} créditos en la base.`);
  if (m.secondsLightsReduced > 0) {
    tradeoffs.push(`Las luces del invernadero se apagaron o bajaron ${round(m.secondsLightsReduced)} s por falta de energía; la batería bajó hasta ${round(minEnergy)} %.`);
  } else {
    tradeoffs.push(`La energía alcanzó para todo; la batería bajó hasta ${round(minEnergy)} %.`);
  }
  if (m.secondsSheltered > 0) {
    tradeoffs.push(`Pasaste ${round(m.secondsSheltered)} s en el refugio: recibiste ${ms.exposure.toFixed(1)} de radiación y las plantas no crecieron mientras tanto.`);
  } else if (ms.exposure > 0) {
    tradeoffs.push(`No entraste al refugio: recibiste ${ms.exposure.toFixed(1)} de radiación.`);
  }
  tradeoffs.push(harvests > 0
    ? `Cosechaste ${harvests} ${harvests === 1 ? 'vez' : 'veces'}; lo más bajo de aire, agua o comida fue ${round(m.minLifeSupport)} %.`
    : `No hubo cosechas; lo más bajo de aire, agua o comida fue ${round(m.minLifeSupport)} %.`);
  return {
    phase: ms.phase,
    failure: ms.failure,
    duration: ms.t,
    design: structuredClone(ms.design),
    harvests,
    exposure: ms.exposure,
    minLifeSupport: m.minLifeSupport,
    secondsLightsReduced: m.secondsLightsReduced,
    secondsSheltered: m.secondsSheltered,
    secondsShortage: m.secondsShortage,
    tradeoffs: tradeoffs.slice(0, 4),
  };
}
