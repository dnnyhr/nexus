import { advanceCycle, createInitialState } from '../engine/simulation';
import type { AppPhase, AttemptSummary, SimulationState, Resources, CycleDecision } from '../engine/types';

export const STORAGE_KEY = 'nexus_ultimo_horizonte_state_v1';

export interface PersistedSession {
  phase: AppPhase;
  simulation: SimulationState;
  previousAttempts: AttemptSummary[];
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageAdapter | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function saveSession(
  session: PersistedSession,
  storage: StorageAdapter | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...session, version: 2 }));
  } catch {
    // Ignorar errores de cuota o modo privado sin romper la simulación
  }
}

export function loadSession(
  storage: StorageAdapter | null = getDefaultStorage()
): PersistedSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 2 || !isSimulation(parsed.simulation) ||
        !Array.isArray(parsed.previousAttempts) || !parsed.previousAttempts.every(isAttempt) ||
        !['briefing', 'mission', 'debrief'].includes(String(parsed.phase))) return null;
    const simulation = parsed.simulation;
    const phase: AppPhase = simulation.status !== 'in_progress' ? 'debrief' :
      simulation.history.length === 0 && parsed.phase === 'briefing' ? 'briefing' : 'mission';
    return { phase, simulation, previousAttempts: parsed.previousAttempts };
  } catch {
    return null;
  }
}

export function clearSession(storage: StorageAdapter | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isResources(value: unknown): value is Resources {
  return isRecord(value) && ['oxygen', 'water', 'food', 'energy'].every(key => isInteger(value[key], 0, 100)) && isInteger(value.exposure, 0, 75);
}

function isDecision(value: unknown): value is CycleDecision {
  return isRecord(value) && ['nominal', 'intensive'].includes(String(value.eclss)) &&
    ['standby', 'active'].includes(String(value.greenhouse)) && ['normal', 'shelter'].includes(String(value.protection));
}

function equalResources(a: Resources, b: Resources): boolean {
  return (Object.keys(a) as Array<keyof Resources>).every(key => a[key] === b[key]);
}

function isSimulation(value: unknown): value is SimulationState {
  if (!isRecord(value) || !isInteger(value.attemptNumber, 1, Number.MAX_SAFE_INTEGER) ||
      !isInteger(value.cycle, 1, 7) || value.maxCycles !== 7 || !isResources(value.resources) ||
      !isInteger(value.cropProgress, 0, 1) || !isInteger(value.harvestsCompleted, 0, 3) ||
      !['in_progress', 'victory', 'failed'].includes(String(value.status)) ||
      !Array.isArray(value.history) || value.history.length > 7) return false;
  let replay = createInitialState(value.attemptNumber);
  try {
    for (const entry of value.history) {
      if (!isRecord(entry) || !isDecision(entry.decision) || !isResources(entry.before) || !isResources(entry.after)) return false;
      replay = advanceCycle(replay, entry.decision);
      const expected = replay.history[replay.history.length - 1];
      if (!equalResources(entry.before, expected.before) || !equalResources(entry.after, expected.after)) return false;
      for (const key of ['cycle', 'solarGeneration', 'radiationDelta', 'radiationLevel', 'cropProgressBefore', 'cropProgressAfter', 'harvested', 'summary', 'scientificNote'] as const) {
        if (entry[key] !== expected[key]) return false;
      }
    }
    return replay.cycle === value.cycle && replay.status === value.status &&
      replay.cropProgress === value.cropProgress && replay.harvestsCompleted === value.harvestsCompleted &&
      equalResources(replay.resources, value.resources) && JSON.stringify(replay.failure) === JSON.stringify(value.failure);
  } catch {
    return false;
  }
}

function isAttempt(value: unknown): value is AttemptSummary {
  return isRecord(value) && isInteger(value.attemptNumber, 1, Number.MAX_SAFE_INTEGER) &&
    ['victory', 'failed'].includes(String(value.status)) && isInteger(value.cyclesCompleted, 1, 7) &&
    isInteger(value.harvestsCompleted, 0, 3) && isResources(value.finalResources);
}
