import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../game/missions';
import type { PowerReport } from '../../game/sim';
import { newGame } from '../../game/state';
import { systemsFromGame, telemetryFromGame } from './adapters';
import { CERTIFICATIONS, certificationStatus, missionTitleKey } from './certificationStatus';
import {
  formatRate,
  riskForExposure,
  riskForPercent,
  tacticalDirective,
  trendOf,
  type DirectiveInput,
} from './logic';

const power: PowerReport = {
  generation: 2.4,
  demand: 1.8,
  running: { processor: true, robots: true, heating: false, lights: 60 },
  shortage: false,
  lifeSupportPowered: true,
};

const nominal: DirectiveInput = {
  o2: 80,
  water: 80,
  food: 80,
  energy: 80,
  generation: 2.4,
  demand: 1.8,
  exposure: 0,
  exposureLimit: 40,
  dark: false,
  sheltered: false,
  storm: false,
};

describe('certifications', () => {
  it('covers all 14 missions with three contiguous groups', () => {
    expect(CERTIFICATIONS).toHaveLength(3);
    expect(CERTIFICATIONS.reduce((total, cert) => total + (cert.to - cert.from + 1), 0)).toBe(14);
    expect(CERTIFICATIONS[0].from).toBe(0);
    expect(CERTIFICATIONS[1].from).toBe(CERTIFICATIONS[0].to + 1);
    expect(CERTIFICATIONS[2].from).toBe(CERTIFICATIONS[1].to + 1);
    expect(CERTIFICATIONS[2].to).toBe(13);
  });

  it('keeps progress when crossing a certification boundary', () => {
    const atFive = certificationStatus(5);
    expect(atFive[0]).toMatchObject({ completed: 5, total: 5, state: 'done' });
    expect(atFive[1]).toMatchObject({ completed: 0, total: 5, state: 'current' });
    expect(atFive[2]).toMatchObject({ completed: 0, total: 4, state: 'pending' });
    expect(atFive[1].missions[0].status).toBe('current');
  });

  it('marks the colony certification current while free play remains open', () => {
    const colony = certificationStatus(13)[2];
    expect(colony).toMatchObject({ completed: 3, total: 4, state: 'current' });
    expect(colony.missions[3].status).toBe('current');
  });

  it('only completes the last certification after the free-play mission', () => {
    expect(certificationStatus(14)[2]).toMatchObject({ completed: 4, total: 4, state: 'done' });
  });

  it('builds mission title keys that exist in the translation table', () => {
    expect(missionTitleKey('ice')).toBe('m_ice_title');
    expect(missionTitleKey(MISSIONS[0])).toBe('m_antenna_title');
  });
});

describe('tactical directive', () => {
  it('puts the exposure limit above every other warning', () => {
    expect(tacticalDirective({ ...nominal, o2: 1, exposure: 40 }).key).toBe('dirExposureLimit');
  });

  it('prioritises the storm over resource warnings when the crew is outside', () => {
    expect(tacticalDirective({ ...nominal, energy: 5, storm: true }).key).toBe('dirStormOutside');
    expect(tacticalDirective({ ...nominal, energy: 5, storm: true, sheltered: true }).key).toBe('dirStormSheltered');
  });

  it('warns before the battery is empty', () => {
    expect(tacticalDirective({ ...nominal, energy: 5 }).key).toBe('dirEnergyCritical');
    expect(tacticalDirective({ ...nominal, energy: 20 }).key).toBe('dirEnergyLow');
  });

  it('connects darkness and negative balance to concrete actions', () => {
    expect(tacticalDirective({ ...nominal, dark: true, energy: 30 }).key).toBe('dirDarkLowEnergy');
    expect(tacticalDirective({ ...nominal, generation: 0, demand: 2 }).key).toBe('dirNetNegative');
  });

  it('reports a healthy balance instead of inventing an alert', () => {
    expect(tacticalDirective(nominal).key).toBe('dirPowerGood');
    expect(tacticalDirective({ ...nominal, generation: 0, demand: 0 }).key).toBe('dirNominal');
  });
});

describe('risk and trend helpers', () => {
  it('classifies percentages without hiding the warning in colour alone', () => {
    expect(riskForPercent(80)).toBe('ok');
    expect(riskForPercent(20)).toBe('caution');
    expect(riskForPercent(5)).toBe('critical');
    expect(riskForPercent(Number.NaN)).toBe('caution');
  });

  it('classifies exposure against the scenario limit', () => {
    expect(riskForExposure(0, 40)).toBe('ok');
    expect(riskForExposure(28, 40)).toBe('caution');
    expect(riskForExposure(36, 40)).toBe('critical');
    expect(riskForExposure(undefined, 40)).toBe('ok');
  });

  it('smooths tiny changes into a steady trend', () => {
    expect(trendOf(10, 9.5)).toBe(1);
    expect(trendOf(10, 10.5)).toBe(-1);
    expect(trendOf(10, 10.01)).toBe(0);
    expect(trendOf(10, undefined)).toBe(0);
  });

  it('formats signed rates for the breaker panel', () => {
    expect(formatRate(1.234)).toBe('+1.2');
    expect(formatRate(-1.234)).toBe('−1.2');
    expect(formatRate(0)).toBe('0.0');
  });
});

describe('game adapters', () => {
  it('turns real game resources into percentages for the ribbon', () => {
    const game = newGame(0);
    const snapshot = telemetryFromGame(game, power, 123);
    expect(snapshot.updatedAt).toBe(123);
    expect(snapshot.o2).toBeCloseTo(90);
    expect(snapshot.energy).toBeCloseTo((100 / 120) * 100);
    expect(snapshot.generation).toBe(2.4);
    expect(snapshot.dark).toBe(false);
    expect(snapshot.exposure).toBeUndefined();
  });

  it('mirrors breaker settings and the real grow-light draw', () => {
    const game = newGame(0);
    game.levels.greenhouse = 1;
    const snapshot = systemsFromGame(game, power);
    expect(snapshot.breakers).toEqual({ heating: true, processor: true, robots: true });
    expect(snapshot.lights).toBe(60);
    expect(snapshot.lightsDraw).toBeCloseTo(0.54);
    expect(snapshot.energy).toBeCloseTo((100 / 120) * 100);
  });
});
