import { MISSIONS, type Mission } from '../../game/missions';
import type { StringKey } from '../i18n';
import { clamp } from './logic';

export type CertificationId = 'foundations' | 'life' | 'colony';
export type CertificationState = 'done' | 'current' | 'pending';
export type MissionStepStatus = 'done' | 'current' | 'pending';

export interface CertificationSpec {
  id: CertificationId;
  titleKey: StringKey;
  descriptionKey: StringKey;
  from: number;
  to: number;
}

export interface MissionStep {
  index: number;
  titleKey: StringKey;
  status: MissionStepStatus;
}

export interface CertificationStatus {
  spec: CertificationSpec;
  completed: number;
  total: number;
  state: CertificationState;
  missions: MissionStep[];
}

export const CERTIFICATIONS: readonly CertificationSpec[] = [
  {
    id: 'foundations',
    titleKey: 'certFoundations',
    descriptionKey: 'certFoundationsDesc',
    from: 0,
    to: 4,
  },
  {
    id: 'life',
    titleKey: 'certLife',
    descriptionKey: 'certLifeDesc',
    from: 5,
    to: 9,
  },
  {
    id: 'colony',
    titleKey: 'certColony',
    descriptionKey: 'certColonyDesc',
    from: 10,
    to: 13,
  },
];

export function missionTitleKey(mission: Mission | string): StringKey {
  return `m_${typeof mission === 'string' ? mission : mission.id}_title` as StringKey;
}

export function certificationStatus(missionIndex: number): CertificationStatus[] {
  const current = clamp(Math.trunc(missionIndex), 0, MISSIONS.length);
  return CERTIFICATIONS.map((spec) => {
    const missions = MISSIONS.slice(spec.from, spec.to + 1).map((mission, offset) => {
      const index = spec.from + offset;
      const status: MissionStepStatus = index < current ? 'done' : index === current ? 'current' : 'pending';
      return { index, titleKey: missionTitleKey(mission), status };
    });
    const total = missions.length;
    const completed = clamp(current - spec.from, 0, total);
    const state: CertificationState = completed >= total ? 'done' : current < spec.from ? 'pending' : 'current';
    return { spec, completed, total, state, missions };
  });
}
