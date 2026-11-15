import type { StringKey } from '../i18n';

export type Risk = 'ok' | 'caution' | 'critical';
export type TrendDirection = -1 | 0 | 1;

export interface DirectiveInput {
  o2: number;
  water: number;
  food: number;
  energy: number;
  generation: number;
  demand: number;
  exposure: number;
  exposureLimit: number;
  dark: boolean;
  sheltered: boolean;
  storm: boolean;
}

export interface Directive {
  key: StringKey;
  vars?: Record<string, string | number>;
  risk: Risk;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function riskForPercent(value: number): Risk {
  if (!Number.isFinite(value)) return 'caution';
  if (value < 10) return 'critical';
  if (value < 25) return 'caution';
  return 'ok';
}

export function riskForExposure(value: number | undefined, limit: number | undefined): Risk {
  if (typeof value !== 'number' || typeof limit !== 'number') return 'ok';
  if (!Number.isFinite(value) || !Number.isFinite(limit)) return 'ok';
  const exposure = value;
  const max = limit;
  if (max <= 0) return exposure > 0 ? 'critical' : 'ok';
  const ratio = exposure / max;
  if (ratio >= 0.9) return 'critical';
  if (ratio >= 0.7) return 'caution';
  return 'ok';
}

export function trendOf(current: number, previous: number | undefined, epsilon = 0.05): TrendDirection {
  if (!Number.isFinite(current) || previous === undefined || !Number.isFinite(previous)) return 0;
  const delta = current - previous;
  if (delta > epsilon) return 1;
  if (delta < -epsilon) return -1;
  return 0;
}

export function tacticalDirective(input: DirectiveInput): Directive {
  const { o2, water, food, energy, generation, demand, exposure, exposureLimit, dark, sheltered, storm } = input;

  if (Number.isFinite(exposureLimit) && (exposureLimit <= 0 ? exposure > 0 : exposure >= exposureLimit)) {
    return { key: 'dirExposureLimit', risk: 'critical' };
  }
  if (storm && !sheltered) return { key: 'dirStormOutside', risk: 'critical' };
  if (storm && sheltered) return { key: 'dirStormSheltered', risk: 'caution' };

  if (o2 < 10) return { key: 'dirO2Low', risk: 'critical' };
  if (water < 10) return { key: 'dirWaterLow', risk: 'critical' };
  if (food < 10) return { key: 'dirFoodLow', risk: 'critical' };
  if (energy < 10) return { key: 'dirEnergyCritical', risk: 'critical' };
  if (energy < 25) return { key: 'dirEnergyLow', risk: 'caution' };
  if (riskForExposure(exposure, exposureLimit) === 'caution') return { key: 'dirExposureHigh', risk: 'caution' };

  if (dark && energy < 40) return { key: 'dirDarkLowEnergy', risk: 'caution' };
  if (Number.isFinite(generation) && Number.isFinite(demand) && generation + 0.05 < demand) {
    return { key: 'dirNetNegative', risk: 'caution' };
  }
  if (o2 < 30) return { key: 'dirO2Low', risk: 'caution' };
  if (water < 30) return { key: 'dirWaterLow', risk: 'caution' };
  if (food < 30) return { key: 'dirFoodLow', risk: 'caution' };
  if (dark) return { key: 'dirDark', risk: 'caution' };
  if (sheltered) return { key: 'dirSheltered', risk: 'ok' };
  if (Number.isFinite(generation) && Number.isFinite(demand) && generation > demand + 0.05) {
    return { key: 'dirPowerGood', risk: 'ok' };
  }
  return { key: 'dirNominal', risk: 'ok' };
}

export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.05) return '0.0';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;
}

export function formatTrend(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude < 0.05) return '0.0';
  return magnitude.toFixed(1);
}
