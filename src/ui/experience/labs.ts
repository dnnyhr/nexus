import type { StringKey } from '../i18n';

export type LabScenarioId = 'darkness' | 'storm' | 'crop';

export interface LabScenario {
  id: LabScenarioId;
  titleKey: StringKey;
  descriptionKey: StringKey;
  goalKey: StringKey;
  seconds: number;
  accent: 'amber' | 'danger' | 'plant';
}

export const LAB_SCENARIOS: readonly LabScenario[] = [
  {
    id: 'darkness',
    titleKey: 'labDarknessTitle',
    descriptionKey: 'labDarknessDesc',
    goalKey: 'labDarknessGoal',
    seconds: 300,
    accent: 'amber',
  },
  {
    id: 'storm',
    titleKey: 'labStormTitle',
    descriptionKey: 'labStormDesc',
    goalKey: 'labStormGoal',
    seconds: 300,
    accent: 'danger',
  },
  {
    id: 'crop',
    titleKey: 'labCropTitle',
    descriptionKey: 'labCropDesc',
    goalKey: 'labCropGoal',
    seconds: 300,
    accent: 'plant',
  },
];
