export type AppPhase = 'briefing' | 'mission' | 'debrief';

export type EclssMode = 'nominal' | 'intensive';
export type GreenhouseMode = 'standby' | 'active';
export type ProtectionMode = 'normal' | 'shelter';

export type RadiationLevel = 'background' | 'elevated' | 'solar_event';
export type MissionStatus = 'in_progress' | 'victory' | 'failed';

export type ResourceKey = 'oxygen' | 'water' | 'food' | 'energy' | 'exposure';

export interface Resources {
  oxygen: number;
  water: number;
  food: number;
  energy: number;
  exposure: number;
}

export interface CycleDecision {
  eclss: EclssMode;
  greenhouse: GreenhouseMode;
  protection: ProtectionMode;
}

export interface ValidationResult {
  valid: boolean;
  blockedByRestriction: boolean;
  insufficientResources: Array<'oxygen' | 'water' | 'energy'>;
  reasons: string[];
}

export interface CyclePreview {
  survivalWarning: FailureDetails | null;
  decision: CycleDecision;
  validation: ValidationResult;
  projected: Resources;
  deltas: Resources;
  projectedCropProgress: number;
  willHarvest: boolean;
  solarGeneration: number;
  radiationDelta: number;
  radiationLevel: RadiationLevel;
}

export interface CycleBreakdownEntry {
  key: ResourceKey;
  start: number;
  solar: number;
  crew: number;
  eclss: number;
  greenhouse: number;
  protection: number;
  harvest: number;
  radiation: number;
  end: number;
  net: number;
}

export interface CycleBreakdown {
  cycle: number;
  rows: CycleBreakdownEntry[];
  willHarvest: boolean;
  survivalWarning: FailureDetails | null;
}

export interface CounterfactualOutcome {
  status: MissionStatus;
  exposure: number;
  failureCode: FailureCode | null;
  cyclesCompleted: number;
}

export interface CounterfactualResult {
  cycle: number;
  summary: string;
  actual: CounterfactualOutcome;
  alternative: CounterfactualOutcome;
  differs: boolean;
}

export interface CycleLogEntry {
  cycle: number;
  decision: CycleDecision;
  before: Resources;
  after: Resources;
  solarGeneration: number;
  radiationDelta: number;
  radiationLevel: RadiationLevel;
  cropProgressBefore: number;
  cropProgressAfter: number;
  harvested: boolean;
  summary: string;
  scientificNote: string;
}

export type FailureCode =
  | 'oxygen_depleted'
  | 'water_depleted'
  | 'food_depleted'
  | 'energy_depleted'
  | 'radiation_exceeded'
  | 'final_thresholds_unmet';

export interface FailureDetails {
  code: FailureCode;
  cycle: number;
  title: string;
  explanation: string;
}

export interface SimulationState {
  attemptNumber: number;
  cycle: number;
  maxCycles: number;
  resources: Resources;
  cropProgress: number;
  harvestsCompleted: number;
  status: MissionStatus;
  failure: FailureDetails | null;
  history: CycleLogEntry[];
}

export interface NasaSource {
  title: string;
  url: string;
  topic: string;
}

export interface DebriefAssessment {
  id: 'life_support' | 'food_strategy' | 'radiation_response';
  title: string;
  rating: 'optimal' | 'adequate' | 'critical';
  finding: string;
  scientificExplanation: string;
  source: NasaSource;
}

export interface DebriefReport {
  status: Exclude<MissionStatus, 'in_progress'>;
  headline: string;
  summary: string;
  cyclesCompleted: number;
  finalResources: Resources;
  harvestsCompleted: number;
  assessments: DebriefAssessment[];
  keyTakeaways: string[];
}

export interface AttemptSummary {
  attemptNumber: number;
  status: Exclude<MissionStatus, 'in_progress'>;
  cyclesCompleted: number;
  finalResources: Resources;
  harvestsCompleted: number;
}
